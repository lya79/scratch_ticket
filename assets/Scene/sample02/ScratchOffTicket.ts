const { ccclass, property } = cc._decorator;

export enum ETouchAction {
    END,
    MOVE,
}

export enum EAudioAction {
    SCRATCH,
}

export interface IItemHandler {
    ItemListener: (items: Map<number, number>) => void;
    GetImageHandler: (pos: number) => cc.SpriteFrame;
    PlayAudio: (action: EAudioAction) => void;
}

class Collision {
    Points: Set<cc.Vec2>;
    Total: number;

    constructor() {
        this.Points = new Set<cc.Vec2>();
        this.Total = 0;
    }

    GetPercentage(): number {
        return Math.floor(((this.Total - this.Points.size) / this.Total) * 100);
    }
}

interface IScratchOffTicket {
    SetItemHandler(itemHandler: IItemHandler);
    SetItems(items: number[]);
    GetItems(): Map<number, number>;
    ScratchAll();
    Scratch(touchAction: ETouchAction, pos: cc.Vec2, lineWidth: number);
    SetShowCoin(show: boolean);
    SetShowScrap(show: boolean);
    SetLock(lock: boolean);
    IsLock(): boolean;
}

@ccclass
export class ScratchOffTicket extends cc.Component implements IScratchOffTicket {

    @property(cc.Prefab)
    ScrapPrefab: cc.Prefab = null;

    // debug變數
    private debugShowTouchPointClass = { show: false, color: cc.Color.RED, size: 1 }; // 顯示觸碰產生的碰撞點
    private debugShowItemPointClass = { show: false, color: cc.Color.BLUE, size: 3 }; // 顯示項目的碰撞點
    private debugShowCollisionPointClass = { show: false, color: cc.Color.BLACK, size: 5 }; // 顯示項目和觸碰的碰撞點
    private debugShowCardPointClass = { show: false, color: cc.Color.RED, size: 5 }; // 顯示項目和觸碰的碰撞點

    // 碰撞相關變數
    private readonly SPACING_OF_POINT_CARD = 70; // 卡片碰撞點的間距
    private readonly SPACING_OF_POINT_ITEM = 10; // 項目判斷點產生的間距
    private readonly SPACING_OF_POINT_TOUCH = 10; // 刮除線段的碰撞點間距
    private readonly LENGTH_LINE_TOUCH = 55; // 線段長度
    private readonly DIFF_COLLISION_ITEM = 10; // 觸碰點和項目點之間允許的碰撞誤差
    private readonly DIFF_COLLISION_CARD = 30; // 觸碰點和卡片點之間允許的碰撞誤差
    private readonly COUNT_COIN_LIMIT = 2; // 錢幣更新偵數
    private readonly COUNT_SCRAP_LIMIT = 5; // 碎屑更新偵數

    // 選項變數
    private showCoin: boolean; // 控制是否顯示錢幣
    private showScrap: boolean; // 控制是否顯示碎屑
    private lockScrap: boolean; // 控制是否使用手動刮除
    private items: Map<number, Collision>; // key: 放置位置, value:等待刮開的項目
    private itemHandler: IItemHandler;
    private scrapPoints: Collision; // 整張卡片的碰撞點(為了用來判斷碎屑產生)

    // 子節點
    private coinNode: cc.Node;
    private ticketNode: cc.Node;
    private maskNode: cc.Node;

    // 暫存
    private tmpDrawPoints: cc.Vec2[]; // 暫存刮除時的觸碰點
    private tmpLastPoint: cc.Vec2; // 暫存最後的刮除位置
    private tmpScrapPoints: cc.Vec2[]; // 暫存有實際刮除到遮罩時的觸碰點
    private tmpCountShowCoin = 0; // 計時錢幣更新偵數
    private tmpCountShowScrap = 0; // 計時碎屑更新偵數
    private scrapNodePool: cc.NodePool;

    init() {
        this.showCoin = false; // 預設不顯顯示硬幣
        this.showScrap = false; // 預設不顯示碎屑
        this.lockScrap = false; // 預設不禁止使用手動刮除

        this.items = new Map<number, Collision>();
        this.itemHandler = null;

        this.tmpDrawPoints = [];
        this.tmpScrapPoints = [];
        this.tmpLastPoint = new cc.Vec2(-3000, -3000);

        this.scrapPoints = new Collision();

        this.ticketNode = this.node.getChildByName("ticket");
        this.maskNode = this.ticketNode.getChildByName("mask");
        this.coinNode = this.node.getChildByName("coin");
        this.coinNode.zIndex = 1; // 為了讓後續才加入的 node能夠顯示在 coin node底下
        this.coinNode.x = -3000;// 初始化錢幣位置到畫面之外
        this.coinNode.y = -3000;

        {
            this.scrapNodePool = new cc.NodePool();

            let initCount = (this.ticketNode.width / this.SPACING_OF_POINT_CARD);
            initCount += (this.ticketNode.height / this.SPACING_OF_POINT_CARD);

            for (let i = 0; i < initCount; ++i) {
                let node = cc.instantiate(this.ScrapPrefab);
                this.scrapNodePool.put(node);
            }
        }

        this.SetItems(null);

        if (cc.sys.isMobile) {
            this.node.on(cc.Node.EventType.TOUCH_END, this.mouseLeave, this);
            this.node.on(cc.Node.EventType.TOUCH_CANCEL, this.mouseLeave, this);
            this.node.on(cc.Node.EventType.TOUCH_MOVE, this.mouseMove, this);
        } else {
            this.node.on(cc.Node.EventType.MOUSE_LEAVE, this.mouseLeave, this);
            this.node.on(cc.Node.EventType.MOUSE_MOVE, this.mouseMove, this);
        }
    }

    protected onDestroy(): void {
        if (cc.sys.isMobile) {
            this.node.off(cc.Node.EventType.TOUCH_END, this.mouseLeave, this);
            this.node.off(cc.Node.EventType.TOUCH_CANCEL, this.mouseLeave, this);
            this.node.off(cc.Node.EventType.TOUCH_MOVE, this.mouseMove, this);
        } else {
            this.node.off(cc.Node.EventType.MOUSE_LEAVE, this.mouseLeave, this);
            this.node.off(cc.Node.EventType.MOUSE_MOVE, this.mouseMove, this);
        }
    }

    SetItemHandler(itemHandler: IItemHandler) {
        this.itemHandler = itemHandler;
    }

    SetItems(items: number[]) {
        this.restMask();

        this.items.clear();

        if (items) {
            for (let i = 0; i < items.length; i++) {
                this.items.set(items[i], new Collision());
            }
        }

        let itemsNode = this.node.getChildByName("items");

        // 先將 items底下全部 node隱藏
        for (let i = 0; i < itemsNode.children.length; i++) {
            itemsNode.children[i].active = false;
        }

        if (this.items.size <= 0) {
            this.ticketNode.active = true;
            return;
        }

        // 將需要的圖片替換上去並且顯示
        for (let entry of Array.from(this.items.entries())) {
            let pos = entry[0]; // key
            // let item = entry[1]; // value

            let name = "item" + pos;
            let itemNode = itemsNode.getChildByName(name);
            if (!itemNode) {
                continue;
            }

            itemNode.active = true;

            let sprite = itemNode.getComponent(cc.Sprite);
            let handler = this.itemHandler.GetImageHandler(pos);
            if (!handler) {
                continue;
            }

            sprite.spriteFrame = handler;
        }

        for (let i = 0; i < itemsNode.children.length; i++) {
            let item = itemsNode.children[i];
            if (!item.active) {
                continue;
            }

            let itemNumber = Number(item.name.substring(4));

            if (isNaN(itemNumber)) {
                continue;
            }

            if (!this.items.has(itemNumber)) {
                continue;
            }

            let worldPoint = item.parent.convertToWorldSpace(item.getPosition());
            let centerPoint = this.ticketNode.convertToNodeSpaceAR(worldPoint);

            if (this.debugShowItemPointClass.show) {
                this.drawPointFunc(centerPoint.x, centerPoint.y, this.debugShowItemPointClass.color, this.debugShowItemPointClass.size, this.ticketNode); // 中心點
            }

            let tmpNode = new cc.Node("tmpNode");
            tmpNode.width = item.width * item.scaleX;
            tmpNode.height = item.height * item.scaleY;
            tmpNode.setPosition(centerPoint.x, centerPoint.y);

            this.ticketNode.addChild(tmpNode);

            for (let k = 0; k <= tmpNode.width; k += this.SPACING_OF_POINT_ITEM) {
                for (let m = 0; m <= tmpNode.height; m += this.SPACING_OF_POINT_ITEM) {
                    let tmpChildNode = new cc.Node("tmpChildNode");
                    tmpChildNode.setPosition(k, m);
                    tmpChildNode.setContentSize(1, 1);

                    tmpNode.addChild(tmpChildNode);
                }
            }

            tmpNode.rotation = item.rotation;

            let collision = this.items.get(itemNumber);
            collision.Total = 0;

            for (let k = 0; k < tmpNode.children.length; k++) {
                let tmpChildNode = tmpNode.children[k];
                if (tmpChildNode.name != "tmpChildNode") {
                    continue;
                }

                let worldPoint = tmpChildNode.parent.convertToWorldSpace(tmpChildNode.getPosition());
                let point = this.ticketNode.convertToNodeSpaceAR(worldPoint);


                collision.Points.add(point);
                collision.Total += 1;

                if (this.debugShowItemPointClass.show) {
                    this.drawPointFunc(point.x, point.y, this.debugShowItemPointClass.color, this.debugShowItemPointClass.size, this.ticketNode); // 其他點
                }

                tmpChildNode.destroy();
            }

            tmpNode.destroy();
        }

        this.ticketNode.active = true;
    }

    GetItems(): Map<number, number> {
        let m = new Map<number, number>();

        for (let entry of Array.from(this.items.entries())) {
            let pos = entry[0]; // key
            let item = entry[1]; // value
            m.set(pos, item.GetPercentage());
        }

        return m;
    }

    ScratchAll() {
        this.ticketNode.active = false;

        for (let entry of Array.from(this.items.entries())) {
            // let pos = entry[0]; // key
            let item = entry[1]; // value
            item.Points.clear();
        }

        if (this.itemHandler) {
            this.itemHandler.ItemListener(this.GetItems()); // callback刮除百分比
        }
    }

    Scratch(touchAction: ETouchAction, pos: cc.Vec2, lineWidth: number) {
        this.clearByPos(touchAction, pos, lineWidth);
    }

    SetShowCoin(show: boolean) {
        this.showCoin = show;
    }

    private mouseLeave(event: cc.Event.EventMouse) {
        if (!this.showCoin) {
            return;
        }

        if (this.lockScrap) {
            return;
        }

        if (!this.ticketNode.active) {
            return;
        }

        this.updateCoinPos(null); // XXX 滑鼠移動到邊緣時會沒有關閉錢幣
    }

    private mouseMove(event: cc.Event.EventMouse) {
        if (!this.showCoin) {
            return;
        }

        if (this.lockScrap) {
            return;
        }

        if (!this.ticketNode.active) {
            return;
        }

        let pos = this.ticketNode.convertToNodeSpaceAR(event.getLocation());
        this.updateCoinPos(pos);

        // this.tmpLastPoint.x = pos.x;
        // this.tmpLastPoint.y = pos.y;

        // if (!this.coinNode.active) {
        //     this.coinNode.setPosition(this.tmpLastPoint.x, this.tmpLastPoint.y);
        // }

        // this.coinNode.active = true;
    }

    SetLock(lock: boolean) {
        if (lock != this.lockScrap) {
            cc.log("auto scrap: " + lock);
        }

        this.lockScrap = lock;
    }

    IsLock(): boolean {
        return this.lockScrap;
    }

    private updateCoinPos(pos: cc.Vec2) {
        if (!pos) {
            this.coinNode.active = false;
            return;
        }

        this.tmpLastPoint.x = pos.x;
        this.tmpLastPoint.y = pos.y;

        if (!this.coinNode.active) {
            this.coinNode.setPosition(this.tmpLastPoint.x, this.tmpLastPoint.y);
        }

        this.coinNode.active = true;
    }

    SetShowScrap(show: boolean) {
        this.showScrap = show;
    }

    private restMask() {
        this.ticketNode.getComponent(cc.Graphics).clear();

        let mask: any = this.maskNode.getComponent(cc.Mask);
        if (mask._graphics) {
            mask._graphics.clear();
        }

        this.tmpDrawPoints = [];
        this.tmpScrapPoints = [];
        this.scrapPoints.Points.clear();
        this.scrapPoints.Total = 0;

        { // 產生卡片碰撞點
            let cardWidth = this.ticketNode.width;
            let cardHeight = this.ticketNode.height;
            let cardWidthHalf = cardWidth / 2;
            let cardHeightHalf = cardHeight / 2;

            for (let x = -cardWidthHalf; x <= cardWidthHalf; x += this.SPACING_OF_POINT_CARD) {
                for (let y = -cardHeightHalf; y <= cardHeightHalf; y += this.SPACING_OF_POINT_CARD) {
                    this.scrapPoints.Points.add(new cc.Vec2(x, y));
                    this.scrapPoints.Total += 1;

                    if (this.debugShowCardPointClass.show) {
                        this.drawPointFunc(x, y, this.debugShowCardPointClass.color, this.debugShowCardPointClass.size, this.ticketNode);
                    }
                }
            }
        }
    }

    private putScrapNode(node: cc.Node) {
        if (!node) {
            return;
        }

        this.scrapNodePool.put(node);
    }

    private getScrapNode(point: cc.Vec2): cc.Node {
        let scrapNode = null;
        if (this.scrapNodePool.size() > 0) {
            scrapNode = this.scrapNodePool.get();
        } else {
            scrapNode = cc.instantiate(this.ScrapPrefab);
        }

        scrapNode.setPosition(point);
        scrapNode.x = point.x + this.getRandomInt(20);
        scrapNode.y = point.y;
        scrapNode.scale = 1;
        scrapNode.rotation = 0;

        let targetY = point.y - this.node.convertToWorldSpaceAR(point).y - scrapNode.height;
        let targetX = this.getRandomInt(40);
        targetX *= (this.getRandomInt(2) == 0 ? 1 : -1);
        targetX += scrapNode.x;

        let targetScale = 1.5;

        let self = this;
        let tween = cc.tween(scrapNode);
        tween.then(cc.tween()
            .to(0.2, { scale: targetScale, position: new cc.Vec2(targetX, targetY) })
            .call(() => {
                scrapNode.parent = null;
                self.putScrapNode(scrapNode);
            })
        );

        tween.start();

        return scrapNode;
    }

    protected update(dt: number): void {
        if (this.showCoin && this.coinNode.active) { // 更新錢幣位置
            this.tmpCountShowCoin += 1;
            if (this.tmpCountShowCoin >= this.COUNT_COIN_LIMIT) {
                this.tmpCountShowCoin = 0;
                this.coinNode.setPosition(this.tmpLastPoint.x, this.tmpLastPoint.y);
            }
        }

        const scrapPointsLength = this.tmpScrapPoints.length;
        if (this.showScrap && scrapPointsLength > 0) { // 產生碎屑動畫
            this.tmpCountShowScrap += 1;
            if (this.tmpCountShowScrap >= this.COUNT_SCRAP_LIMIT) {
                this.tmpCountShowScrap = 0;

                if (this.itemHandler) {
                    this.itemHandler.PlayAudio(EAudioAction.SCRATCH);
                }

                for (let k = 0; k < scrapPointsLength; k++) {
                    let point = this.tmpScrapPoints.shift();
                    let scrapNode = this.getScrapNode(point);
                    this.node.addChild(scrapNode)
                }
            }
        }
    }

    private clearByPos(touchAction: ETouchAction, touchPos: cc.Vec2, lineWidth: number) { // XXX 改善效能
        if (!this.ticketNode.active) {
            return;
        }

        if (touchAction == ETouchAction.END) {
            this.tmpDrawPoints = [];
            this.coinNode.active = false;
            return;
        }

        let pos = this.ticketNode.convertToNodeSpaceAR(touchPos);

        if (this.tmpDrawPoints.length >= 2) {
            this.tmpDrawPoints[0].x = this.tmpDrawPoints[1].x;
            this.tmpDrawPoints[0].y = this.tmpDrawPoints[1].y;

            this.tmpDrawPoints[1].x = pos.x;
            this.tmpDrawPoints[1].y = pos.y;
        } else {
            this.tmpDrawPoints.push(pos);
        }

        if (this.tmpDrawPoints.length <= 1) {
            return;
        }

        if (this.IsLock()) { // 手動被關閉使用時會自動顯示錢幣
            this.updateCoinPos(pos);
        }

        let mask: any = this.maskNode.getComponent(cc.Mask);
        let stencil: cc.Graphics = mask._graphics;

        // 每次判斷都判斷最新的位置, 之前的跳過節能效能
        let prevPos = this.tmpDrawPoints[this.tmpDrawPoints.length - 2];
        let curPos = this.tmpDrawPoints[this.tmpDrawPoints.length - 1];

        if (this.scrapPoints.Points.size > 0) {// 處理刮除時候掉碎屑的位置
            let self = this;
            let tmpDelScrapPoints = new Set<cc.Vec2>();

            this.scrapPoints.Points.forEach(function (scrapPoint) {
                if (self.getDistance(scrapPoint, curPos) >= self.DIFF_COLLISION_CARD) { // 允許的碰撞誤差
                    return;
                }

                tmpDelScrapPoints.add(scrapPoint);

                if (self.showScrap) {
                    self.tmpScrapPoints.push(new cc.Vec2(scrapPoint.x, scrapPoint.y));
                }
            });

            tmpDelScrapPoints.forEach(function (scrapPoint) {
                self.scrapPoints.Points.delete(scrapPoint);
            });
        }

        let tmpLineWidth = (lineWidth > this.LENGTH_LINE_TOUCH ? lineWidth : this.LENGTH_LINE_TOUCH);
        let tmpLineWidth21 = (tmpLineWidth / 2);

        {// 刮除遮罩
            stencil.moveTo(prevPos.x, prevPos.y);
            stencil.lineTo(curPos.x, curPos.y);
            stencil.lineWidth = tmpLineWidth;
            stencil.strokeColor = cc.color(255, 255, 255, 255);
            stencil.stroke();
        }

        let collisionPointsTouch: cc.Vec2[] = []; // XXX 有時候刮除轉彎時會漏掉部分碰撞點沒有產生
        {// 產生判斷點  
            let diff = (this.getDistance(curPos, prevPos) / this.SPACING_OF_POINT_TOUCH) - 2;
            let count = (diff < 0 ? 0 : diff);
            let arr: cc.Vec2[] = [];
            arr.push(prevPos);
            arr.push(curPos);
            let arr2 = this.bezierCalculate(arr, arr.length + count); // 先取得兩點之間的中心點
            for (let i = 0; i < (arr2.length - 1); i++) {
                let tmpPrevPos = arr2[i];
                let tmpCurPos = arr2[i + 1];

                let obj = this.calculatorRotation(tmpCurPos, tmpPrevPos);
                let rotation = obj.rotation;

                if (!isNaN(rotation) && rotation == 0) {
                    for (let i = (tmpCurPos.x - tmpLineWidth21); i <= (tmpCurPos.x + tmpLineWidth21); i += this.SPACING_OF_POINT_TOUCH) {
                        collisionPointsTouch.push(new cc.Vec2(i, tmpCurPos.y));

                        if (this.debugShowTouchPointClass.show) {// 顯示碰撞的點
                            this.drawPointFunc(i, tmpCurPos.y, this.debugShowTouchPointClass.color, this.debugShowTouchPointClass.size, this.ticketNode);
                        }
                    }
                } else {
                    for (let i = (tmpCurPos.y - tmpLineWidth21); i <= (tmpCurPos.y + tmpLineWidth21); i += this.SPACING_OF_POINT_TOUCH) {
                        collisionPointsTouch.push(new cc.Vec2(tmpCurPos.x, i));

                        if (this.debugShowTouchPointClass.show) {// 顯示碰撞的點
                            this.drawPointFunc(tmpCurPos.x, i, this.debugShowTouchPointClass.color, this.debugShowTouchPointClass.size, this.ticketNode);
                        }
                    }
                }
            }
        }

        let self = this;

        for (let i = 0; i < collisionPointsTouch.length; i++) {// 判斷項目消除百分比
            let touchPoint = collisionPointsTouch[i];

            for (let entry of Array.from(this.items.entries())) {
                // let pos = entry[0]; // key
                let item = entry[1]; // value
                let tmpDelScrapPoints = new Set<cc.Vec2>();

                item.Points.forEach(function (itemPoint) {
                    if (self.getDistance(itemPoint, touchPoint) >= self.DIFF_COLLISION_ITEM) { // 允許的碰撞誤差
                        return;
                    }

                    tmpDelScrapPoints.add(itemPoint);

                    if (self.itemHandler) {
                        self.itemHandler.ItemListener(self.GetItems()); // callback刮除百分比
                    }

                    if (self.debugShowCollisionPointClass.show) {
                        self.drawPointFunc(itemPoint.x, itemPoint.y, self.debugShowCollisionPointClass.color, self.debugShowCollisionPointClass.size, self.ticketNode);
                    }
                });

                tmpDelScrapPoints.forEach(function (scrapPoint) {
                    item.Points.delete(scrapPoint);
                });
            }
        }
    }

    /**
    * 更新砲塔旋轉角度
    * 依據玩家點擊的位置
    */
    private calculatorRotation(locationOfTouch: cc.Vec2, locationOfTower: cc.Vec2): { rotation: number } {
        let x = locationOfTouch.x;
        let y = locationOfTouch.y;

        let px = locationOfTower.x;
        let py = locationOfTower.y;

        let pointA = new cc.Vec2(px, py); // 砲塔位置
        let pointB = new cc.Vec2(x, y); // 滑鼠位置
        let pointC = new cc.Vec2(px, y); // 基準點

        let newRotation = this.getAngle(pointA, pointB, pointC); // 砲塔要旋轉的角度

        if (x < px) {
            newRotation *= -1;
        }

        if (pointA.y > pointC.y) {
            if (x < px) {
                newRotation = -180 - newRotation;
            } else if (x > px) {
                newRotation = 180 - newRotation;
            }
        }

        return { rotation: newRotation };
    }

    private getAngle(A: cc.Vec2, B: cc.Vec2, C: cc.Vec2) {
        var AB = Math.sqrt(Math.pow(A.x - B.x, 2) + Math.pow(A.y - B.y, 2));
        var AC = Math.sqrt(Math.pow(A.x - C.x, 2) + Math.pow(A.y - C.y, 2));
        var BC = Math.sqrt(Math.pow(B.x - C.x, 2) + Math.pow(B.y - C.y, 2));
        var cosA = (
            Math.pow(AB, 2) + Math.pow(AC, 2) - Math.pow(BC, 2)
        ) / (
                2 * AB * AC
            );
        var angleA = Math.round(Math.acos(cosA) * 180 / Math.PI);
        return angleA;
    }

    private getDistance(a: cc.Vec2, b: cc.Vec2): number {
        let x = a.x - b.x;
        let y = a.y - b.y;
        return Math.sqrt(x * x + y * y);
    }

    private bezierCalculate(poss, precision) { // 包含頭尾
        precision -= 1;

        //维度，坐标轴数（二维坐标，三维坐标...）
        let dimersion = 2;

        //贝塞尔曲线控制点数（阶数）
        let number = poss.length;

        //控制点数不小于 2 ，至少为二维坐标系
        if (number < 2 || dimersion < 2)
            return null;

        let result = new Array();

        //计算杨辉三角
        let mi = new Array();
        mi[0] = mi[1] = 1;
        for (let i = 3; i <= number; i++) {

            let t = new Array();
            for (let j = 0; j < i - 1; j++) {
                t[j] = mi[j];
            }

            mi[0] = mi[i - 1] = 1;
            for (let j = 0; j < i - 2; j++) {
                mi[j + 1] = t[j] + t[j + 1];
            }
        }

        //计算坐标点
        for (let i = 0; i <= precision; i++) {
            let t = i / precision;
            // let p = new Point(0, 0);
            let p = {
                x: 0,
                y: 0,
            };
            result.push(p);
            for (let j = 0; j < dimersion; j++) {
                let temp = 0.0;
                for (let k = 0; k < number; k++) {
                    temp += Math.pow(1 - t, number - k - 1) * (j == 0 ? poss[k].x : poss[k].y) * Math.pow(t, k) * mi[k];
                }
                j == 0 ? p.x = temp : p.y = temp;
            }
            // p.x = this.toDecimal(p.x);
            // p.y = this.toDecimal(p.y);
        }

        // result.push(poss[poss.length-1])

        return result;
    }

    private drawPointFunc(x: number, y: number, color: cc.Color, size: number, parentNode: cc.Node) {
        let node: cc.Node = new cc.Node("debugNode");
        var graphics = node.addComponent(cc.Graphics);
        graphics.circle(x, y, size);
        graphics.fillColor = color;
        graphics.stroke();
        graphics.fill();
        parentNode.addChild(node);
    }

    private getRandomInt(max) {
        return Math.floor(Math.random() * max);

        // console.log(getRandomInt(3));
        // expected output: 0, 1 or 2
    }
}
