import { ScratchOffTicket, ETouchAction, IItemHandler } from "./ScratchOffTicket";

const { ccclass, property } = cc._decorator;

@ccclass
export default class Sample02Main extends cc.Component { // TODO 要測試手機板和電腦版是否都正常操作
    @property(cc.SpriteFrame)
    imageCoin: cc.SpriteFrame = null;

    @property(cc.SpriteFrame)
    imageScraps: cc.SpriteFrame = null;

    @property(cc.SpriteFrame)
    imagePos1: cc.SpriteFrame = null;

    @property(cc.SpriteFrame)
    imagePos2: cc.SpriteFrame = null;

    @property(cc.SpriteFrame)
    imagePos3: cc.SpriteFrame = null;

    @property(cc.SpriteFrame)
    imagePos4: cc.SpriteFrame = null;

    // @property(cc.AudioClip)
    // audioLongScraps: cc.AudioClip = null;

    // @property(cc.AudioClip)
    // audioShortScraps1: cc.AudioClip = null;

    // @property(cc.AudioClip)
    // audioShortScraps2: cc.AudioClip = null;

    // @property(cc.AudioClip)
    // audioShortScraps3: cc.AudioClip = null;

    // @property(cc.AudioClip)
    // audioShortScraps4: cc.AudioClip = null;

    // @property(cc.AudioClip)
    // audioShortScraps5: cc.AudioClip = null;

    private scratchOffTicket: ScratchOffTicket;

    protected onLoad(): void {
        { // 初始化刮刮樂
            let ticketNode = this.node.getChildByName("ticket");

            this.scratchOffTicket = ticketNode.getComponent("ScratchOffTicket");
            this.scratchOffTicket.init();

            let itemHandler: IItemHandler;

            let progressNode = this.node.getChildByName("progress");


            let self = this;
            class Methods implements IItemHandler {
                private posAndImg = new Map<number, cc.SpriteFrame>();

                constructor() {
                    // 設定獎項位置對應的圖片
                    this.posAndImg.set(1, self.imagePos1);
                    this.posAndImg.set(2, self.imagePos2);
                    this.posAndImg.set(3, self.imagePos3);
                    this.posAndImg.set(4, self.imagePos4);
                }

                ItemListener(items: Map<number, number>) {
                    for (let entry of Array.from(items.entries())) {
                        let pos = entry[0]; // key
                        let percentage = entry[1]; // value
                        // cc.log("項目" + pos + " 已經刮除:" + percentage);

                        let itemNode = progressNode.getChildByName("item" + pos);
                        if (itemNode) {
                            itemNode.getComponent(cc.Label).string = "項目 " + pos + "已經刮開: " + percentage + "%";
                        }
                    }
                }

                GetImageHandler(pos: number): cc.SpriteFrame {
                    cc.log("替換項目圖片 項目" + pos + ", 圖片:" + this.posAndImg.get(pos).name);
                    return this.posAndImg.get(pos);
                }
            }

            itemHandler = new Methods();

            this.scratchOffTicket.SetItemHandler(itemHandler);
        }

        { // 設定刮刮樂錢幣
            let coinNode = new cc.Node("CoinNode");
            coinNode.anchorX = 0.18;
            let sprite = coinNode.addComponent(cc.Sprite);
            sprite.spriteFrame = this.imageCoin
            this.scratchOffTicket.SetCoinNode(coinNode);
        }

        { // TODO 設定刮刮樂刮除的動畫(已經刮除的區塊不會觸發產生粉末動畫)
            this.scratchOffTicket.SetScrap(this.imageScraps);
        }

        { // TODO 設定刮刮樂音效(已經刮除的區塊不會觸發撥放音效)

        }

        {
            let btnResetNode = this.node.getChildByName("btn").getChildByName("btnReset");
            btnResetNode.on("click", this.resetItem, this);

            let btnReset3Node = this.node.getChildByName("btn").getChildByName("btnReset3");
            btnReset3Node.on("click", this.reset3Item, this);

            let btnReset4Node = this.node.getChildByName("btn").getChildByName("btnReset4");
            btnReset4Node.on("click", this.reset4Item, this);
        }

        this.node.on(cc.Node.EventType.TOUCH_START, this.touchStartEvent, this);
        this.node.on(cc.Node.EventType.TOUCH_MOVE, this.touchMoveEvent, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.touchEndEvent, this);
        this.node.on(cc.Node.EventType.TOUCH_CANCEL, this.touchEndEvent, this);
    }

    private resetItem() {
        this.reset(0);
    }

    private reset3Item() {
        this.reset(3);
    }

    private reset4Item() {
        this.reset(4);
    }

    private reset(num: number) {
        if (num <= 0) {
            this.scratchOffTicket.SetItems(null);
            return;
        }

        let items: number[];

        if (num == 3) {
            items = [1, 2, 4];
        } else if (num == 4) {
            items = [1, 2, 3, 4];
        }

        cc.log("重置項目:" + items);

        let progressNode = this.node.getChildByName("progress");
        for (let i = 0; i < items.length; i++) {
            let pos = items[i];
            let itemNode = progressNode.getChildByName("item" + pos);
            if (itemNode) {
                itemNode.getComponent(cc.Label).string = "項目 " + pos + "已經刮開: 0%";
            }
        }

        this.scratchOffTicket.SetItems(items);
    }

    protected onDestroy(): void {
        this.node.off(cc.Node.EventType.TOUCH_START, this.touchStartEvent, this);
        this.node.off(cc.Node.EventType.TOUCH_MOVE, this.touchMoveEvent, this);
        this.node.off(cc.Node.EventType.TOUCH_END, this.touchEndEvent, this);
        this.node.off(cc.Node.EventType.TOUCH_CANCEL, this.touchEndEvent, this);
    }

    protected start(): void {
    }

    touchStartEvent(event: cc.Event.EventTouch) {
        let ticketNode = this.node.getChildByName("ticket").getChildByName("ticket");
        let point = ticketNode.convertToNodeSpaceAR(event.getLocation());

        this.scratchOffTicket.Scratch(
            ETouchAction.START,
            new cc.Vec2(point.x, point.y),
        );
    }

    touchMoveEvent(event: cc.Event.EventTouch) {
        let ticketNode = this.node.getChildByName("ticket").getChildByName("ticket");
        let point = ticketNode.convertToNodeSpaceAR(event.getLocation());

        this.scratchOffTicket.Scratch(
            ETouchAction.MOVE,
            new cc.Vec2(point.x, point.y),
        );
    }

    touchEndEvent() {
        this.scratchOffTicket.Scratch(
            ETouchAction.END,
            null,
        );
    }
}
