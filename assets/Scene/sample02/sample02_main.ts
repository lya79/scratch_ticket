import { ScratchOffTicket, ETouchAction, IItemHandler, EAudioAction } from "./ScratchOffTicket";

const { ccclass, property } = cc._decorator;

@ccclass
export default class Sample02Main extends cc.Component {
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

    @property({ type: cc.AudioClip })
    audioScratch: cc.AudioClip[] = [];

    private scratchOffTicket: ScratchOffTicket;

    protected onLoad(): void {
        { // 初始化刮刮樂
            let progressNode = this.node.getChildByName("progress");
            let ticketNode = this.node.getChildByName("ticket");
            this.scratchOffTicket = ticketNode.getComponent("ScratchOffTicket");
            this.scratchOffTicket.init();

            let self = this;

            class Methods implements IItemHandler {

                ItemListener(items: Map<number, number>) {
                    if (!items) {
                        return;
                    }

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
                    let posAndImg = new Map<number, cc.SpriteFrame>(); // 設定獎項位置對應的圖片
                    posAndImg.set(1, self.imagePos1);
                    posAndImg.set(2, self.imagePos2);
                    posAndImg.set(3, self.imagePos3);
                    posAndImg.set(4, self.imagePos4);

                    if (!posAndImg.has(pos)) {
                        cc.log("error 替換項目圖片失敗 項目" + pos);
                        return;
                    }

                    cc.log("替換項目圖片 項目" + pos + ", 圖片:" + posAndImg.get(pos).name);

                    return posAndImg.get(pos);
                }

                PlayAudio(action: EAudioAction) {
                    if (action == EAudioAction.SCRATCH) {
                        let getRandomInt = function (max) {
                            return Math.floor(Math.random() * max);
                        }

                        let idx = getRandomInt(self.audioScratch.length - 1) + 1; // audioScratch索引0是長度7秒的聲音(自動刮除使用)
                        let clip: cc.AudioClip = self.audioScratch[idx];
                        cc.audioEngine.playEffect(clip, false);

                        // cc.log("播放刮除音效:" + clip.name);
                    }
                }
            }

            this.scratchOffTicket.SetItemHandler(new Methods());
        }

        this.scratchOffTicket.ShowCoin(true);
        this.scratchOffTicket.ShowScrap(true);

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
        let point = new cc.Vec2(event.getLocation().x, event.getLocation().y);
        this.scratchOffTicket.Scratch(ETouchAction.START, point);
    }

    touchMoveEvent(event: cc.Event.EventTouch) {
        let point = new cc.Vec2(event.getLocation().x, event.getLocation().y);
        this.scratchOffTicket.Scratch(ETouchAction.MOVE, point);
    }

    touchEndEvent() {
        this.scratchOffTicket.Scratch(ETouchAction.END, null);
    }
}
