const { ccclass, property } = cc._decorator;

export enum ETouchAction {
    START,
    MOVE,
    END,
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
    Point: cc.Vec2[];
    Collision: boolean[];

    constructor() {
        this.Point = [];
        this.Collision = [];
    }

    GetPercentage(): number {
        let count = 0;
        for (let i = 0; i < this.Collision.length; i++) {
            if (this.Collision[i]) {
                count += 1;
            }
        }
        return Math.floor((count / this.Collision.length) * 100);
    }
}

interface IScratchOffTicket {
    SetItemHandler(itemHandler: IItemHandler);
    SetItems(items: number[]);
    GetItems(): Map<number, number>;
    Scratch(touchAction: ETouchAction, pos: cc.Vec2);
    SetCoinNode(node: cc.Node);
    SetScrap(image: cc.SpriteFrame);
}

@ccclass
export class ScratchOffTicket extends cc.Component implements IScratchOffTicket {

    // debug變數
    private debugShowTouchPointClass = { show: false, color: cc.Color.RED, size: 1 }; // 顯示觸碰產生的碰撞點
    private debugShowItemPointClass = { show: false, color: cc.Color.BLUE, size: 3 }; // 顯示項目的碰撞點
    private debugShowCollisionPointClass = { show: false, color: cc.Color.BLACK, size: 5 }; // 顯示項目和觸碰的碰撞點
    private debugShowCardPointClass = { show: false, color: cc.Color.RED, size: 5 }; // 顯示項目和觸碰的碰撞點

    // 碰撞相關變數
    private readonly SPACING_OF_POINT_CARD = 70; // 卡片碰撞點的間距
    private readonly SPACING_OF_POINT_ITEM = 10; // 項目判斷點產生的間距
    private readonly SPACING_OF_POINT_TOUCH = 10; // 刮除線段的碰撞點間距
    private readonly LENGTH_LINE_TOUCH = 50; // 線段長度
    private readonly LENGTH_LINE_TOUCH_21 = (50 / 2); // 線段長度的一半
    private readonly DIFF_COLLISION_ITEM = 10; // 觸碰點和項目點之間允許的碰撞誤差
    private readonly DIFF_COLLISION_CARD = 30; // 觸碰點和卡片點之間允許的碰撞誤差

    // 選項變數
    private showCoin: boolean;
    private showScrap: boolean;

    private items: Map<number, Collision>; // key: 放置位置, value:等待刮開的項目
    private itemHandler: IItemHandler;
    private imageScrap: cc.SpriteFrame;
    private cardPoints: Collision; // 整張卡片的碰撞點(為了用來判斷碎屑產生)

    private coinNode: cc.Node;

    // 暫存
    private tmpDrawPoints: cc.Vec2[]; // 暫存刮除時的觸碰點
    private tmpLastPoint: cc.Vec2; // 暫存最後的刮除位置
    private tmpScrapPoints: cc.Vec2[]; // 暫存有實際刮除到遮罩時的觸碰點



    init() {
        this.showCoin = false; // 預設不顯顯示硬幣
        this.showScrap = false; // 預設不顯示碎屑

        this.items = new Map<number, Collision>();
        this.itemHandler = null;

        this.tmpDrawPoints = [];
        this.tmpScrapPoints = [];
        this.tmpLastPoint = new cc.Vec2();

        this.cardPoints = new Collision();
        this.cardPoints.Collision = [];
        this.cardPoints.Point = [];

        // 初始化錢幣位置到畫面之外
        this.tmpLastPoint.x = -3000;
        this.tmpLastPoint.y = -3000;

        this.coinNode = this.node.getChildByName("coin");
        this.coinNode.zIndex = 1; // 為了讓後續才加入的 node能夠顯示在 coin node底下

        this.SetItems(null);

        this.node.on(cc.Node.EventType.MOUSE_ENTER, this.mouseEnter, this);
        this.node.on(cc.Node.EventType.MOUSE_LEAVE, this.mouseLeave, this);
        this.node.on(cc.Node.EventType.MOUSE_MOVE, this.mouseMove, this);
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

        {
            let ticketNode = this.node.getChildByName("ticket");

            let drawPointFunc = function (x: number, y: number, color: cc.Color, size: number, parentNode: cc.Node) {
                let node: cc.Node = new cc.Node("debugNode");
                var graphics = node.addComponent(cc.Graphics);
                graphics.circle(x, y, size);
                graphics.fillColor = color;
                graphics.stroke();
                graphics.fill();
                parentNode.addChild(node);
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
                let centerPoint = ticketNode.convertToNodeSpaceAR(worldPoint);

                if (this.debugShowItemPointClass.show) {
                    drawPointFunc(centerPoint.x, centerPoint.y, this.debugShowItemPointClass.color, this.debugShowItemPointClass.size, ticketNode); // 中心點
                }

                let tmpNode = new cc.Node("tmpNode");
                tmpNode.width = item.width * item.scaleX;
                tmpNode.height = item.height * item.scaleY;
                tmpNode.setPosition(centerPoint.x, centerPoint.y);

                ticketNode.addChild(tmpNode);

                for (let k = 0; k <= tmpNode.width; k += this.SPACING_OF_POINT_ITEM) {
                    for (let m = 0; m <= tmpNode.height; m += this.SPACING_OF_POINT_ITEM) {
                        let tmpChildNode = new cc.Node("tmpChildNode");
                        tmpChildNode.setPosition(k, m);
                        tmpChildNode.setContentSize(1, 1);

                        tmpNode.addChild(tmpChildNode);
                    }
                }

                tmpNode.rotation = item.rotation;

                for (let k = 0; k < tmpNode.children.length; k++) {
                    let tmpChildNode = tmpNode.children[k];
                    if (tmpChildNode.name != "tmpChildNode") {
                        continue;
                    }

                    let worldPoint = tmpChildNode.parent.convertToWorldSpace(tmpChildNode.getPosition());
                    let point = ticketNode.convertToNodeSpaceAR(worldPoint);

                    let collision = this.items.get(itemNumber);
                    collision.Point.push(point);
                    collision.Collision.push(false);

                    if (this.debugShowItemPointClass.show) {
                        drawPointFunc(point.x, point.y, this.debugShowItemPointClass.color, this.debugShowItemPointClass.size, ticketNode); // 其他點
                    }

                    tmpChildNode.destroy();
                }

                tmpNode.destroy();
            }
        }
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

    Scratch(touchAction: ETouchAction, pos: cc.Vec2) {
        this.clearByPos(touchAction, pos);
    }

    SetCoinNode(node: cc.Node) {
        this.showCoin = false;

        // 初始化錢幣位置到畫面之外
        this.tmpLastPoint.x = -3000;
        this.tmpLastPoint.y = -3000;

        for (let i = 0; i < this.coinNode.children.length; i++) {
            this.coinNode.children[i].destroy();
        }

        if (!node) {
            return;
        }

        this.showCoin = true;

        this.coinNode.addChild(node);
    }

    private mouseEnter(event: cc.Event.EventMouse) {
        this.coinNode.active = true;
    }
    private mouseLeave(event: cc.Event.EventMouse) {
        this.coinNode.active = false; // XXX 滑鼠移動到邊緣時會沒有關閉錢幣
    }

    private mouseMove(event: cc.Event.EventMouse) {
        let ticketNode = this.node.getChildByName("ticket");
        let point = ticketNode.convertToNodeSpaceAR(event.getLocation());

        this.tmpLastPoint.x = point.x;
        this.tmpLastPoint.y = point.y;
    }

    // private tmpCountUpdate = 0; // 計時 update次數

    protected update(dt: number): void {
        {
            // // 計時
            // this.tmpCountUpdate += 1;
            // if (this.tmpCountUpdate < 1) {
            //     return;
            // }
            // this.tmpCountUpdate = 0;

            // 計時
            // this.tmpCountUpdate += dt;
            // if (this.tmpCountUpdate >= 0.2) {
            //     this.tmpCountUpdate = 0;
            // }
        }


        if (this.showCoin) { // 更新錢幣位置
            this.coinNode.setPosition(this.tmpLastPoint.x, this.tmpLastPoint.y);
        }

        if (this.showScrap && this.tmpScrapPoints.length > 0) { // 產生碎屑動畫 // XXX 需要改善效能
            let len = this.tmpScrapPoints.length;

            if (this.itemHandler) {
                this.itemHandler.PlayAudio(EAudioAction.SCRATCH);
            }

            for (let k = 0; k < len; k++) {
                let point = this.tmpScrapPoints.shift();

                let scrapNode = new cc.Node("scrapNode");
                scrapNode.setContentSize(this.imageScrap.getRect().size);
                scrapNode.setPosition(point);
                scrapNode.x = point.x + this.getRandomInt(20);
                scrapNode.y = point.y;
                scrapNode.scale = 1;
                scrapNode.rotation = 0;
                scrapNode.addComponent(cc.Sprite).spriteFrame = this.imageScrap;
                this.node.addChild(scrapNode)

                let targetY = point.y - this.node.convertToWorldSpaceAR(point).y - scrapNode.height;
                let targetX = this.getRandomInt(20);
                targetX *= (this.getRandomInt(2) == 0 ? 1 : -1);
                targetX += scrapNode.x;

                let targetScale = 1.5;

                let tween = cc.tween(scrapNode);
                tween.then(cc.tween()
                    .to(0.2, { scale: targetScale, position: new cc.Vec2(targetX, targetY) })
                    .call(() => { scrapNode.destroy(); })
                );

                tween.start();
            }
        }
    }

    getRandomInt(max) {
        return Math.floor(Math.random() * max);

        // console.log(getRandomInt(3));
        // expected output: 0, 1 or 2
    }

    SetScrap(image: cc.SpriteFrame) {
        this.imageScrap = image;

        if (!image) {
            this.showScrap = false;
            return;
        }

        this.showScrap = true;

        // cc.log("size: " + image.getOriginalSize()); // (27.00, 29.00)
        // cc.log("size: " + image.getRect()); // (2.00, 2.00, 23.00, 25.00)
        // cc.log("size: " + image.getTexture().width + ", " + image.getTexture().height); // 27, 29
    }

    private restMask() {
        let ticketNode = this.node.getChildByName("ticket");
        let maskNode = ticketNode.getChildByName("mask");

        ticketNode.getComponent(cc.Graphics).clear();

        let mask: any = maskNode.getComponent(cc.Mask);
        if (mask._graphics) {
            mask._graphics.clear();
        }

        this.tmpDrawPoints = [];
        this.tmpScrapPoints = [];
        this.cardPoints.Collision = [];
        this.cardPoints.Point = [];

        { // 產生卡片碰撞點
            let drawPointFunc = function (x: number, y: number, color: cc.Color, size: number, parentNode: cc.Node) {
                let node: cc.Node = new cc.Node("debugNode");
                var graphics = node.addComponent(cc.Graphics);
                graphics.circle(x, y, size);
                graphics.fillColor = color;
                graphics.stroke();
                graphics.fill();
                parentNode.addChild(node);
            }

            let cardWidth = ticketNode.width;
            let cardHeight = ticketNode.height;
            let cardWidthHalf = cardWidth / 2;
            let cardHeightHalf = cardHeight / 2;

            for (let x = -cardWidthHalf; x <= cardWidthHalf; x += this.SPACING_OF_POINT_CARD) {
                for (let y = -cardHeightHalf; y <= cardHeightHalf; y += this.SPACING_OF_POINT_CARD) {
                    this.cardPoints.Point.push(new cc.Vec2(x, y));
                    this.cardPoints.Collision.push(false);

                    if (this.debugShowCardPointClass.show) {
                        drawPointFunc(x, y, this.debugShowCardPointClass.color, this.debugShowCardPointClass.size, ticketNode);
                    }
                }
            }
        }
    }

    private clearByPos(touchAction: ETouchAction, touchPos: cc.Vec2) {
        if (touchAction == ETouchAction.END) {
            this.tmpDrawPoints = [];
            return;
        }

        let ticketNode = this.node.getChildByName("ticket");

        let pos = ticketNode.convertToNodeSpaceAR(touchPos);

        const len = this.tmpDrawPoints.length;

        this.tmpDrawPoints.push(pos);

        if (len <= 1) {
            return;
        }

        {// 暫存刮除點的位置(已經刮除過的位置不可以掉碎屑)
            for (let k = 0; k < this.cardPoints.Collision.length; k++) {
                if (this.cardPoints.Collision[k]) {
                    continue;
                }

                let distance = this.getDistance(this.cardPoints.Point[k], pos);
                if (distance >= this.DIFF_COLLISION_CARD) { // 允許的碰撞誤差
                    continue;
                }

                this.cardPoints.Collision[k] = true;

                this.tmpScrapPoints.push(new cc.Vec2(this.cardPoints.Point[k].x, this.cardPoints.Point[k].y));
            }
        }

        // let ticketNode = this.node.getChildByName("ticket");
        let maskNode = ticketNode.getChildByName("mask");

        let mask: any = maskNode.getComponent(cc.Mask);
        let stencil: cc.Graphics = mask._graphics;

        let drawPointFunc = function (x: number, y: number, color: cc.Color, size: number, parentNode: cc.Node) {
            let node: cc.Node = new cc.Node("debugNode");
            var graphics = node.addComponent(cc.Graphics);
            graphics.circle(x, y, size);
            graphics.fillColor = color;
            graphics.stroke();
            graphics.fill();
            parentNode.addChild(node);
        }

        let prevPos = this.tmpDrawPoints[len - 2];
        let curPos = this.tmpDrawPoints[len - 1];

        {// 刮除遮罩
            stencil.moveTo(prevPos.x, prevPos.y);
            stencil.lineTo(curPos.x, curPos.y);
            stencil.lineWidth = this.LENGTH_LINE_TOUCH;
            stencil.strokeColor = cc.color(255, 255, 255, 255);
            stencil.stroke();
        }

        let collisionPointsTouch: cc.Vec2[] = [];
        {// 產生判斷點  // XXX 有時候刮除轉彎時會漏掉部分碰撞點沒有產生
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
                    for (let i = (tmpCurPos.x - this.LENGTH_LINE_TOUCH_21); i <= (tmpCurPos.x + this.LENGTH_LINE_TOUCH_21); i += this.SPACING_OF_POINT_TOUCH) {
                        collisionPointsTouch.push(new cc.Vec2(i, tmpCurPos.y));

                        if (this.debugShowTouchPointClass.show) {// 顯示碰撞的點
                            drawPointFunc(i, tmpCurPos.y, this.debugShowTouchPointClass.color, this.debugShowTouchPointClass.size, ticketNode);
                        }
                    }
                } else {
                    for (let i = (tmpCurPos.y - this.LENGTH_LINE_TOUCH_21); i <= (tmpCurPos.y + this.LENGTH_LINE_TOUCH_21); i += this.SPACING_OF_POINT_TOUCH) {
                        collisionPointsTouch.push(new cc.Vec2(tmpCurPos.x, i));

                        if (this.debugShowTouchPointClass.show) {// 顯示碰撞的點
                            drawPointFunc(tmpCurPos.x, i, this.debugShowTouchPointClass.color, this.debugShowTouchPointClass.size, ticketNode);
                        }
                    }
                }
            }
        }

        for (let i = 0; i < collisionPointsTouch.length; i++) {// 判斷項目消除百分比
            let touchPoint = collisionPointsTouch[i];

            for (let entry of Array.from(this.items.entries())) {
                // let pos = entry[0]; // key
                let item = entry[1]; // value

                for (let k = 0; k < item.Point.length; k++) {
                    if (item.Collision[k]) {
                        continue;
                    }

                    let itemPoint = item.Point[k];

                    let distance = this.getDistance(itemPoint, touchPoint);
                    if (distance >= this.DIFF_COLLISION_ITEM) { // 允許的碰撞誤差
                        continue;
                    }

                    item.Collision[k] = true;

                    if (this.itemHandler) {
                        this.itemHandler.ItemListener(this.GetItems()); // callback刮除百分比
                    }

                    if (this.debugShowCollisionPointClass.show) {
                        drawPointFunc(itemPoint.x, itemPoint.y, this.debugShowCollisionPointClass.color, this.debugShowCollisionPointClass.size, ticketNode);
                    }
                }
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
}
