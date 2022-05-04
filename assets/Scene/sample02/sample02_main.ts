import { IScratchOffTicket, ScratchOffTicket, ETouchAction, IItemHandler, EAudioAction } from "./ScratchOffTicket";

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

    private scratchOffTicket: IScratchOffTicket;

    protected onLoad(): void {
        { // 初始化刮刮樂
            let progressNode = this.node.getChildByName("progress");
            let ticketNode = this.node.getChildByName("ticket");
            this.scratchOffTicket = ticketNode.getComponent("ScratchOffTicket");
            this.scratchOffTicket.Init();

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

        this.scratchOffTicket.SetShowCoin(true);
        this.scratchOffTicket.SetShowScrap(true);

        {
            let btnResetNode = this.node.getChildByName("btn").getChildByName("btnReset");
            btnResetNode.on("click", this.resetItem, this);

            let btnReset3Node = this.node.getChildByName("btn").getChildByName("btnReset3");
            btnReset3Node.on("click", this.reset3Item, this);

            let btnReset4Node = this.node.getChildByName("btn").getChildByName("btnReset4");
            btnReset4Node.on("click", this.reset4Item, this);

            let btnClearNode = this.node.getChildByName("btn").getChildByName("btnClear");
            btnClearNode.on("click", this.clearMask, this);

            let btnAuto1Node = this.node.getChildByName("btn").getChildByName("btnAuto1");
            btnAuto1Node.on("click", this.auto1, this);

            let btnAuto2Node = this.node.getChildByName("btn").getChildByName("btnAuto2");
            btnAuto2Node.on("click", this.auto2, this);
        }

        this.node.getChildByName("autoInfo").getComponent(cc.Label).string = "自動刮除狀態: false";

        this.resetItem();

        this.node.on(cc.Node.EventType.TOUCH_START, this.touchMoveEvent, this);
        this.node.on(cc.Node.EventType.TOUCH_MOVE, this.touchMoveEvent, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.touchEndEvent, this);
        this.node.on(cc.Node.EventType.TOUCH_CANCEL, this.touchEndEvent, this);
    }

    private clearMask() {
        this.scratchOffTicket.ScratchAll();
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

    protected update(dt: number): void {
        let info = "自動刮除狀態: ";
        info += (this.scratchOffTicket && this.scratchOffTicket.IsLock() ? "true" : "false");

        this.node.getChildByName("autoInfo").getComponent(cc.Label).string = info;
    }

    private reset(num: number) {
        let progressNode = this.node.getChildByName("progress");
        for (let i = 0; i < progressNode.children.length; i++) {
            let item = progressNode.children[i];
            item.getComponent(cc.Label).string = item.name + " 已經刮開: 0%";
        }

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

        this.scratchOffTicket.SetItems(items);
    }

    protected onDestroy(): void {
        this.node.off(cc.Node.EventType.TOUCH_START, this.touchMoveEvent, this);
        this.node.off(cc.Node.EventType.TOUCH_MOVE, this.touchMoveEvent, this);
        this.node.off(cc.Node.EventType.TOUCH_END, this.touchEndEvent, this);
        this.node.off(cc.Node.EventType.TOUCH_CANCEL, this.touchEndEvent, this);
    }

    protected start(): void {
    }

    touchMoveEvent(event: cc.Event.EventTouch) {
        if (this.scratchOffTicket.IsLock()) {
            return;
        }

        let point = new cc.Vec2(event.getLocation().x, event.getLocation().y);
        this.scratchOffTicket.Scratch(ETouchAction.MOVE, point, 55);
    }

    touchEndEvent() {
        if (this.scratchOffTicket.IsLock()) {
            return;
        }

        this.scratchOffTicket.Scratch(ETouchAction.END, null, 55);
    }

    private auto1() {
        this.auto(1);
    }

    private auto2() {
        this.auto(2);
    }

    private auto(kind: number) {
        if (this.scratchOffTicket.IsLock()) {
            return;
        }

        let delay: number;
        let lineWidth: number;
        let arr: cc.Vec2[]

        if (kind == 1) {
            delay = 0.005;
            lineWidth = 120;
            arr = this.getAutoPath1();
        } else {
            delay = 0.006;
            lineWidth = 130;
            arr = this.getAutoPath2();
        }

        let tween = cc.tween(this.node);

        const diff = this.node.height - 25;

        let self = this;
        let run = function (action: ETouchAction, point: cc.Vec2, delay: number, lineWidth: number, lock: boolean) {
            self.scratchOffTicket.SetLock(true);

            tween.then(cc.tween()
                .delay(delay)
                .call(() => {
                    self.scratchOffTicket.Scratch(action, point, lineWidth);
                })
            );

            if (!lock) {
                tween.then(cc.tween()
                    .delay(1) // 額外的延遲
                    .call(() => {
                        self.scratchOffTicket.SetLock(false);
                    })
                );
            }
        };

        for (let i = 0; i < arr.length; i++) {
            let action = (i == arr.length - 1 ? ETouchAction.END : ETouchAction.MOVE);
            let pos = arr[i];
            let point = new cc.Vec2(pos.x, diff - pos.y);
            let lock = (i == arr.length - 1 ? false : true);

            run(action, point, delay, lineWidth, lock);
        }

        tween.start();
    }

    private getAutoPath1(): cc.Vec2[] {
        let paths: cc.Vec2[] = [];
        {
            paths.push(new cc.Vec2(36, 852));
            paths.push(new cc.Vec2(36, 852));
            paths.push(new cc.Vec2(36, 852));
            paths.push(new cc.Vec2(36, 852));
            paths.push(new cc.Vec2(36, 853));
            paths.push(new cc.Vec2(35, 853));
            paths.push(new cc.Vec2(35, 857));
            paths.push(new cc.Vec2(33, 862));
            paths.push(new cc.Vec2(32, 868));
            paths.push(new cc.Vec2(32, 873));
            paths.push(new cc.Vec2(31, 880));
            paths.push(new cc.Vec2(30, 885));
            paths.push(new cc.Vec2(30, 890));
            paths.push(new cc.Vec2(30, 893));
            paths.push(new cc.Vec2(30, 897));
            paths.push(new cc.Vec2(30, 900));
            paths.push(new cc.Vec2(30, 901));
            paths.push(new cc.Vec2(30, 901));
            paths.push(new cc.Vec2(30, 901));
            paths.push(new cc.Vec2(30, 900));
            paths.push(new cc.Vec2(31, 896));
            paths.push(new cc.Vec2(33, 890));
            paths.push(new cc.Vec2(37, 885));
            paths.push(new cc.Vec2(42, 877));
            paths.push(new cc.Vec2(45, 872));
            paths.push(new cc.Vec2(48, 867));
            paths.push(new cc.Vec2(50, 865));
            paths.push(new cc.Vec2(51, 863));
            paths.push(new cc.Vec2(51, 863));
            paths.push(new cc.Vec2(51, 865));
            paths.push(new cc.Vec2(51, 868));
            paths.push(new cc.Vec2(51, 877));
            paths.push(new cc.Vec2(47, 895));
            paths.push(new cc.Vec2(42, 911));
            paths.push(new cc.Vec2(35, 938));
            paths.push(new cc.Vec2(26, 963));
            paths.push(new cc.Vec2(22, 980));
            paths.push(new cc.Vec2(18, 995));
            paths.push(new cc.Vec2(17, 1000));
            paths.push(new cc.Vec2(17, 1002));
            paths.push(new cc.Vec2(17, 1002));
            paths.push(new cc.Vec2(17, 1002));
            paths.push(new cc.Vec2(18, 1001));
            paths.push(new cc.Vec2(21, 993));
            paths.push(new cc.Vec2(26, 982));
            paths.push(new cc.Vec2(36, 965));
            paths.push(new cc.Vec2(45, 948));
            paths.push(new cc.Vec2(65, 916));
            paths.push(new cc.Vec2(81, 890));
            paths.push(new cc.Vec2(102, 855));
            paths.push(new cc.Vec2(111, 838));
            paths.push(new cc.Vec2(116, 825));
            paths.push(new cc.Vec2(117, 821));
            paths.push(new cc.Vec2(117, 821));
            paths.push(new cc.Vec2(117, 821));
            paths.push(new cc.Vec2(117, 821));
            paths.push(new cc.Vec2(117, 823));
            paths.push(new cc.Vec2(116, 831));
            paths.push(new cc.Vec2(112, 857));
            paths.push(new cc.Vec2(107, 880));
            paths.push(new cc.Vec2(92, 925));
            paths.push(new cc.Vec2(80, 961));
            paths.push(new cc.Vec2(65, 1005));
            paths.push(new cc.Vec2(53, 1041));
            paths.push(new cc.Vec2(50, 1060));
            paths.push(new cc.Vec2(48, 1071));
            paths.push(new cc.Vec2(48, 1072));
            paths.push(new cc.Vec2(48, 1072));
            paths.push(new cc.Vec2(48, 1071));
            paths.push(new cc.Vec2(51, 1066));
            paths.push(new cc.Vec2(57, 1050));
            paths.push(new cc.Vec2(67, 1027));
            paths.push(new cc.Vec2(77, 1006));
            paths.push(new cc.Vec2(96, 970));
            paths.push(new cc.Vec2(113, 936));
            paths.push(new cc.Vec2(138, 892));
            paths.push(new cc.Vec2(151, 868));
            paths.push(new cc.Vec2(161, 848));
            paths.push(new cc.Vec2(163, 840));
            paths.push(new cc.Vec2(163, 837));
            paths.push(new cc.Vec2(163, 837));
            paths.push(new cc.Vec2(162, 842));
            paths.push(new cc.Vec2(161, 863));
            paths.push(new cc.Vec2(156, 888));
            paths.push(new cc.Vec2(147, 931));
            paths.push(new cc.Vec2(137, 963));
            paths.push(new cc.Vec2(128, 1003));
            paths.push(new cc.Vec2(120, 1048));
            paths.push(new cc.Vec2(117, 1071));
            paths.push(new cc.Vec2(115, 1091));
            paths.push(new cc.Vec2(115, 1096));
            paths.push(new cc.Vec2(115, 1096));
            paths.push(new cc.Vec2(115, 1096));
            paths.push(new cc.Vec2(116, 1095));
            paths.push(new cc.Vec2(117, 1092));
            paths.push(new cc.Vec2(123, 1073));
            paths.push(new cc.Vec2(132, 1051));
            paths.push(new cc.Vec2(142, 1030));
            paths.push(new cc.Vec2(161, 988));
            paths.push(new cc.Vec2(176, 957));
            paths.push(new cc.Vec2(195, 920));
            paths.push(new cc.Vec2(206, 897));
            paths.push(new cc.Vec2(213, 880));
            paths.push(new cc.Vec2(215, 876));
            paths.push(new cc.Vec2(215, 875));
            paths.push(new cc.Vec2(215, 876));
            paths.push(new cc.Vec2(215, 880));
            paths.push(new cc.Vec2(213, 896));
            paths.push(new cc.Vec2(210, 935));
            paths.push(new cc.Vec2(205, 967));
            paths.push(new cc.Vec2(195, 1018));
            paths.push(new cc.Vec2(190, 1053));
            paths.push(new cc.Vec2(183, 1093));
            paths.push(new cc.Vec2(182, 1115));
            paths.push(new cc.Vec2(182, 1128));
            paths.push(new cc.Vec2(182, 1130));
            paths.push(new cc.Vec2(183, 1130));
            paths.push(new cc.Vec2(183, 1130));
            paths.push(new cc.Vec2(185, 1125));
            paths.push(new cc.Vec2(192, 1105));
            paths.push(new cc.Vec2(200, 1085));
            paths.push(new cc.Vec2(216, 1048));
            paths.push(new cc.Vec2(230, 1016));
            paths.push(new cc.Vec2(252, 963));
            paths.push(new cc.Vec2(271, 921));
            paths.push(new cc.Vec2(280, 896));
            paths.push(new cc.Vec2(288, 868));
            paths.push(new cc.Vec2(291, 858));
            paths.push(new cc.Vec2(292, 853));
            paths.push(new cc.Vec2(292, 853));
            paths.push(new cc.Vec2(292, 853));
            paths.push(new cc.Vec2(292, 853));
            paths.push(new cc.Vec2(292, 863));
            paths.push(new cc.Vec2(290, 882));
            paths.push(new cc.Vec2(286, 921));
            paths.push(new cc.Vec2(282, 950));
            paths.push(new cc.Vec2(276, 990));
            paths.push(new cc.Vec2(273, 1013));
            paths.push(new cc.Vec2(272, 1038));
            paths.push(new cc.Vec2(272, 1047));
            paths.push(new cc.Vec2(272, 1051));
            paths.push(new cc.Vec2(272, 1052));
            paths.push(new cc.Vec2(272, 1051));
            paths.push(new cc.Vec2(272, 1048));
            paths.push(new cc.Vec2(275, 1036));
            paths.push(new cc.Vec2(278, 1025));
            paths.push(new cc.Vec2(285, 1006));
            paths.push(new cc.Vec2(291, 988));
            paths.push(new cc.Vec2(300, 966));
            paths.push(new cc.Vec2(306, 952));
            paths.push(new cc.Vec2(313, 936));
            paths.push(new cc.Vec2(318, 926));
            paths.push(new cc.Vec2(321, 923));
            paths.push(new cc.Vec2(321, 922));
            paths.push(new cc.Vec2(321, 922));
            paths.push(new cc.Vec2(321, 927));
            paths.push(new cc.Vec2(320, 941));
            paths.push(new cc.Vec2(318, 966));
            paths.push(new cc.Vec2(316, 993));
            paths.push(new cc.Vec2(316, 1011));
            paths.push(new cc.Vec2(316, 1030));
            paths.push(new cc.Vec2(316, 1038));
            paths.push(new cc.Vec2(316, 1043));
            paths.push(new cc.Vec2(316, 1043));
            paths.push(new cc.Vec2(317, 1043));
            paths.push(new cc.Vec2(317, 1041));
            paths.push(new cc.Vec2(323, 1025));
            paths.push(new cc.Vec2(331, 1006));
            paths.push(new cc.Vec2(343, 976));
            paths.push(new cc.Vec2(357, 948));
            paths.push(new cc.Vec2(375, 908));
            paths.push(new cc.Vec2(386, 882));
            paths.push(new cc.Vec2(400, 851));
            paths.push(new cc.Vec2(406, 836));
            paths.push(new cc.Vec2(410, 826));
            paths.push(new cc.Vec2(410, 822));
            paths.push(new cc.Vec2(410, 822));
            paths.push(new cc.Vec2(410, 822));
            paths.push(new cc.Vec2(410, 823));
            paths.push(new cc.Vec2(408, 831));
            paths.push(new cc.Vec2(407, 853));
            paths.push(new cc.Vec2(405, 877));
            paths.push(new cc.Vec2(398, 920));
            paths.push(new cc.Vec2(393, 952));
            paths.push(new cc.Vec2(388, 997));
            paths.push(new cc.Vec2(385, 1037));
            paths.push(new cc.Vec2(383, 1057));
            paths.push(new cc.Vec2(383, 1076));
            paths.push(new cc.Vec2(383, 1082));
            paths.push(new cc.Vec2(383, 1082));
            paths.push(new cc.Vec2(383, 1082));
            paths.push(new cc.Vec2(383, 1082));
            paths.push(new cc.Vec2(385, 1081));
            paths.push(new cc.Vec2(388, 1065));
            paths.push(new cc.Vec2(398, 1035));
            paths.push(new cc.Vec2(407, 1010));
            paths.push(new cc.Vec2(421, 966));
            paths.push(new cc.Vec2(431, 932));
            paths.push(new cc.Vec2(447, 886));
            paths.push(new cc.Vec2(457, 857));
            paths.push(new cc.Vec2(467, 825));
            paths.push(new cc.Vec2(472, 810));
            paths.push(new cc.Vec2(476, 798));
            paths.push(new cc.Vec2(476, 797));
            paths.push(new cc.Vec2(476, 797));
            paths.push(new cc.Vec2(476, 798));
            paths.push(new cc.Vec2(472, 815));
            paths.push(new cc.Vec2(468, 841));
            paths.push(new cc.Vec2(458, 887));
            paths.push(new cc.Vec2(450, 926));
            paths.push(new cc.Vec2(440, 981));
            paths.push(new cc.Vec2(432, 1032));
            paths.push(new cc.Vec2(428, 1061));
            paths.push(new cc.Vec2(426, 1091));
            paths.push(new cc.Vec2(426, 1102));
            paths.push(new cc.Vec2(426, 1105));
            paths.push(new cc.Vec2(426, 1105));
            paths.push(new cc.Vec2(426, 1105));
            paths.push(new cc.Vec2(427, 1103));
            paths.push(new cc.Vec2(430, 1095));
            paths.push(new cc.Vec2(435, 1077));
            paths.push(new cc.Vec2(446, 1050));
            paths.push(new cc.Vec2(461, 1016));
            paths.push(new cc.Vec2(475, 987));
            paths.push(new cc.Vec2(496, 943));
            paths.push(new cc.Vec2(510, 912));
            paths.push(new cc.Vec2(523, 878));
            paths.push(new cc.Vec2(531, 860));
            paths.push(new cc.Vec2(536, 843));
            paths.push(new cc.Vec2(537, 838));
            paths.push(new cc.Vec2(537, 837));
            paths.push(new cc.Vec2(537, 837));
            paths.push(new cc.Vec2(537, 838));
            paths.push(new cc.Vec2(536, 842));
            paths.push(new cc.Vec2(532, 865));
            paths.push(new cc.Vec2(526, 886));
            paths.push(new cc.Vec2(515, 923));
            paths.push(new cc.Vec2(506, 953));
            paths.push(new cc.Vec2(496, 992));
            paths.push(new cc.Vec2(488, 1021));
            paths.push(new cc.Vec2(487, 1035));
            paths.push(new cc.Vec2(487, 1041));
            paths.push(new cc.Vec2(487, 1042));
            paths.push(new cc.Vec2(487, 1042));
            paths.push(new cc.Vec2(487, 1041));
            paths.push(new cc.Vec2(487, 1040));
            paths.push(new cc.Vec2(490, 1032));
            paths.push(new cc.Vec2(493, 1021));
            paths.push(new cc.Vec2(500, 1010));
            paths.push(new cc.Vec2(510, 990));
            paths.push(new cc.Vec2(516, 977));
            paths.push(new cc.Vec2(522, 962));
            paths.push(new cc.Vec2(525, 956));
            paths.push(new cc.Vec2(526, 955));
            paths.push(new cc.Vec2(526, 955));
            paths.push(new cc.Vec2(525, 956));
            paths.push(new cc.Vec2(523, 966));
            paths.push(new cc.Vec2(520, 983));
            paths.push(new cc.Vec2(516, 1012));
            paths.push(new cc.Vec2(511, 1042));
            paths.push(new cc.Vec2(510, 1065));
            paths.push(new cc.Vec2(508, 1092));
            paths.push(new cc.Vec2(508, 1108));
            paths.push(new cc.Vec2(508, 1122));
            paths.push(new cc.Vec2(508, 1126));
            paths.push(new cc.Vec2(508, 1127));
            paths.push(new cc.Vec2(508, 1126));
            paths.push(new cc.Vec2(511, 1122));
            paths.push(new cc.Vec2(516, 1110));
            paths.push(new cc.Vec2(527, 1085));
            paths.push(new cc.Vec2(537, 1062));
            paths.push(new cc.Vec2(558, 1020));
            paths.push(new cc.Vec2(576, 988));
            paths.push(new cc.Vec2(600, 938));
            paths.push(new cc.Vec2(616, 908));
            paths.push(new cc.Vec2(628, 876));
            paths.push(new cc.Vec2(637, 852));
            paths.push(new cc.Vec2(640, 842));
            paths.push(new cc.Vec2(641, 838));
            paths.push(new cc.Vec2(641, 838));
            paths.push(new cc.Vec2(641, 838));
            paths.push(new cc.Vec2(640, 838));
            paths.push(new cc.Vec2(640, 846));
            paths.push(new cc.Vec2(636, 875));
            paths.push(new cc.Vec2(630, 915));
            paths.push(new cc.Vec2(622, 948));
            paths.push(new cc.Vec2(612, 993));
            paths.push(new cc.Vec2(606, 1021));
            paths.push(new cc.Vec2(601, 1058));
            paths.push(new cc.Vec2(598, 1077));
            paths.push(new cc.Vec2(596, 1093));
            paths.push(new cc.Vec2(596, 1097));
            paths.push(new cc.Vec2(596, 1098));
            paths.push(new cc.Vec2(596, 1097));
            paths.push(new cc.Vec2(597, 1097));
            paths.push(new cc.Vec2(598, 1091));
            paths.push(new cc.Vec2(603, 1070));
            paths.push(new cc.Vec2(607, 1052));
            paths.push(new cc.Vec2(617, 1021));
            paths.push(new cc.Vec2(625, 993));
            paths.push(new cc.Vec2(638, 955));
            paths.push(new cc.Vec2(647, 931));
            paths.push(new cc.Vec2(656, 906));
            paths.push(new cc.Vec2(660, 892));
            paths.push(new cc.Vec2(661, 887));
            paths.push(new cc.Vec2(661, 886));
            paths.push(new cc.Vec2(661, 886));
            paths.push(new cc.Vec2(661, 888));
            paths.push(new cc.Vec2(658, 902));
            paths.push(new cc.Vec2(655, 933));
            paths.push(new cc.Vec2(650, 967));
            paths.push(new cc.Vec2(646, 993));
            paths.push(new cc.Vec2(641, 1027));
            paths.push(new cc.Vec2(638, 1047));
            paths.push(new cc.Vec2(637, 1065));
            paths.push(new cc.Vec2(637, 1071));
            paths.push(new cc.Vec2(637, 1072));
            paths.push(new cc.Vec2(637, 1072));
            paths.push(new cc.Vec2(638, 1071));
            paths.push(new cc.Vec2(640, 1065));
            paths.push(new cc.Vec2(646, 1046));
            paths.push(new cc.Vec2(651, 1030));
            paths.push(new cc.Vec2(658, 1005));
            paths.push(new cc.Vec2(665, 987));
            paths.push(new cc.Vec2(671, 963));
            paths.push(new cc.Vec2(675, 947));
            paths.push(new cc.Vec2(678, 931));
            paths.push(new cc.Vec2(681, 922));
            paths.push(new cc.Vec2(681, 920));
            paths.push(new cc.Vec2(681, 920));
            paths.push(new cc.Vec2(681, 920));
            paths.push(new cc.Vec2(681, 920));
            paths.push(new cc.Vec2(681, 922));
            paths.push(new cc.Vec2(681, 928));
            paths.push(new cc.Vec2(678, 943));
            paths.push(new cc.Vec2(675, 965));
            paths.push(new cc.Vec2(672, 982));
            paths.push(new cc.Vec2(668, 1007));
            paths.push(new cc.Vec2(666, 1025));
            paths.push(new cc.Vec2(665, 1043));
            paths.push(new cc.Vec2(663, 1053));
            paths.push(new cc.Vec2(663, 1061));
            paths.push(new cc.Vec2(663, 1063));
            paths.push(new cc.Vec2(663, 1066));
            paths.push(new cc.Vec2(663, 1066));
            paths.push(new cc.Vec2(663, 1066));
            paths.push(new cc.Vec2(663, 1066));
            paths.push(new cc.Vec2(663, 1066));
        }
        return paths;
    }

    private getAutoPath2(): cc.Vec2[] {
        let paths: cc.Vec2[] = [];
        {
            paths.push(new cc.Vec2(39, 840));
            paths.push(new cc.Vec2(39, 841));
            paths.push(new cc.Vec2(39, 845));
            paths.push(new cc.Vec2(39, 850));
            paths.push(new cc.Vec2(37, 864));
            paths.push(new cc.Vec2(36, 881));
            paths.push(new cc.Vec2(32, 908));
            paths.push(new cc.Vec2(31, 930));
            paths.push(new cc.Vec2(29, 958));
            paths.push(new cc.Vec2(29, 985));
            paths.push(new cc.Vec2(29, 1001));
            paths.push(new cc.Vec2(29, 1020));
            paths.push(new cc.Vec2(29, 1032));
            paths.push(new cc.Vec2(29, 1036));
            paths.push(new cc.Vec2(29, 1038));
            paths.push(new cc.Vec2(29, 1038));
            paths.push(new cc.Vec2(29, 1038));
            paths.push(new cc.Vec2(31, 1037));
            paths.push(new cc.Vec2(33, 1025));
            paths.push(new cc.Vec2(39, 1006));
            paths.push(new cc.Vec2(50, 979));
            paths.push(new cc.Vec2(59, 955));
            paths.push(new cc.Vec2(75, 915));
            paths.push(new cc.Vec2(90, 876));
            paths.push(new cc.Vec2(103, 850));
            paths.push(new cc.Vec2(114, 822));
            paths.push(new cc.Vec2(119, 809));
            paths.push(new cc.Vec2(123, 797));
            paths.push(new cc.Vec2(123, 795));
            paths.push(new cc.Vec2(123, 795));
            paths.push(new cc.Vec2(123, 796));
            paths.push(new cc.Vec2(120, 809));
            paths.push(new cc.Vec2(118, 825));
            paths.push(new cc.Vec2(109, 861));
            paths.push(new cc.Vec2(103, 888));
            paths.push(new cc.Vec2(94, 928));
            paths.push(new cc.Vec2(89, 956));
            paths.push(new cc.Vec2(83, 996));
            paths.push(new cc.Vec2(79, 1026));
            paths.push(new cc.Vec2(79, 1041));
            paths.push(new cc.Vec2(79, 1050));
            paths.push(new cc.Vec2(79, 1050));
            paths.push(new cc.Vec2(79, 1050));
            paths.push(new cc.Vec2(82, 1041));
            paths.push(new cc.Vec2(87, 1022));
            paths.push(new cc.Vec2(93, 995));
            paths.push(new cc.Vec2(99, 966));
            paths.push(new cc.Vec2(108, 938));
            paths.push(new cc.Vec2(120, 897));
            paths.push(new cc.Vec2(129, 868));
            paths.push(new cc.Vec2(143, 828));
            paths.push(new cc.Vec2(152, 801));
            paths.push(new cc.Vec2(156, 790));
            paths.push(new cc.Vec2(157, 785));
            paths.push(new cc.Vec2(157, 785));
            paths.push(new cc.Vec2(156, 785));
            paths.push(new cc.Vec2(156, 787));
            paths.push(new cc.Vec2(154, 809));
            paths.push(new cc.Vec2(151, 836));
            paths.push(new cc.Vec2(145, 884));
            paths.push(new cc.Vec2(141, 920));
            paths.push(new cc.Vec2(136, 973));
            paths.push(new cc.Vec2(135, 1015));
            paths.push(new cc.Vec2(135, 1040));
            paths.push(new cc.Vec2(135, 1068));
            paths.push(new cc.Vec2(135, 1079));
            paths.push(new cc.Vec2(135, 1084));
            paths.push(new cc.Vec2(135, 1084));
            paths.push(new cc.Vec2(135, 1083));
            paths.push(new cc.Vec2(139, 1074));
            paths.push(new cc.Vec2(151, 1038));
            paths.push(new cc.Vec2(169, 990));
            paths.push(new cc.Vec2(182, 951));
            paths.push(new cc.Vec2(198, 897));
            paths.push(new cc.Vec2(208, 858));
            paths.push(new cc.Vec2(222, 812));
            paths.push(new cc.Vec2(227, 785));
            paths.push(new cc.Vec2(230, 776));
            paths.push(new cc.Vec2(230, 772));
            paths.push(new cc.Vec2(230, 772));
            paths.push(new cc.Vec2(230, 774));
            paths.push(new cc.Vec2(230, 785));
            paths.push(new cc.Vec2(228, 804));
            paths.push(new cc.Vec2(223, 842));
            paths.push(new cc.Vec2(220, 874));
            paths.push(new cc.Vec2(215, 925));
            paths.push(new cc.Vec2(210, 982));
            paths.push(new cc.Vec2(210, 1019));
            paths.push(new cc.Vec2(210, 1058));
            paths.push(new cc.Vec2(211, 1074));
            paths.push(new cc.Vec2(213, 1088));
            paths.push(new cc.Vec2(213, 1091));
            paths.push(new cc.Vec2(215, 1091));
            paths.push(new cc.Vec2(216, 1086));
            paths.push(new cc.Vec2(225, 1056));
            paths.push(new cc.Vec2(235, 1028));
            paths.push(new cc.Vec2(249, 985));
            paths.push(new cc.Vec2(259, 955));
            paths.push(new cc.Vec2(269, 915));
            paths.push(new cc.Vec2(274, 893));
            paths.push(new cc.Vec2(279, 872));
            paths.push(new cc.Vec2(281, 863));
            paths.push(new cc.Vec2(281, 863));
            paths.push(new cc.Vec2(281, 863));
            paths.push(new cc.Vec2(279, 867));
            paths.push(new cc.Vec2(277, 884));
            paths.push(new cc.Vec2(272, 925));
            paths.push(new cc.Vec2(267, 956));
            paths.push(new cc.Vec2(264, 997));
            paths.push(new cc.Vec2(263, 1033));
            paths.push(new cc.Vec2(263, 1052));
            paths.push(new cc.Vec2(263, 1071));
            paths.push(new cc.Vec2(264, 1077));
            paths.push(new cc.Vec2(264, 1078));
            paths.push(new cc.Vec2(264, 1078));
            paths.push(new cc.Vec2(264, 1077));
            paths.push(new cc.Vec2(267, 1073));
            paths.push(new cc.Vec2(278, 1048));
            paths.push(new cc.Vec2(294, 1015));
            paths.push(new cc.Vec2(307, 989));
            paths.push(new cc.Vec2(327, 943));
            paths.push(new cc.Vec2(341, 908));
            paths.push(new cc.Vec2(359, 863));
            paths.push(new cc.Vec2(370, 837));
            paths.push(new cc.Vec2(380, 809));
            paths.push(new cc.Vec2(386, 791));
            paths.push(new cc.Vec2(387, 787));
            paths.push(new cc.Vec2(387, 786));
            paths.push(new cc.Vec2(387, 786));
            paths.push(new cc.Vec2(387, 789));
            paths.push(new cc.Vec2(386, 799));
            paths.push(new cc.Vec2(385, 813));
            paths.push(new cc.Vec2(381, 841));
            paths.push(new cc.Vec2(375, 879));
            paths.push(new cc.Vec2(371, 912));
            paths.push(new cc.Vec2(365, 966));
            paths.push(new cc.Vec2(363, 1006));
            paths.push(new cc.Vec2(361, 1061));
            paths.push(new cc.Vec2(361, 1106));
            paths.push(new cc.Vec2(361, 1127));
            paths.push(new cc.Vec2(364, 1142));
            paths.push(new cc.Vec2(364, 1145));
            paths.push(new cc.Vec2(364, 1145));
            paths.push(new cc.Vec2(364, 1145));
            paths.push(new cc.Vec2(364, 1145));
            paths.push(new cc.Vec2(364, 1145));
            paths.push(new cc.Vec2(365, 1140));
            paths.push(new cc.Vec2(374, 1117));
            paths.push(new cc.Vec2(387, 1081));
            paths.push(new cc.Vec2(396, 1052));
            paths.push(new cc.Vec2(410, 1010));
            paths.push(new cc.Vec2(416, 980));
            paths.push(new cc.Vec2(425, 938));
            paths.push(new cc.Vec2(431, 908));
            paths.push(new cc.Vec2(438, 871));
            paths.push(new cc.Vec2(442, 847));
            paths.push(new cc.Vec2(445, 838));
            paths.push(new cc.Vec2(445, 835));
            paths.push(new cc.Vec2(445, 833));
            paths.push(new cc.Vec2(445, 833));
            paths.push(new cc.Vec2(445, 835));
            paths.push(new cc.Vec2(445, 847));
            paths.push(new cc.Vec2(443, 886));
            paths.push(new cc.Vec2(440, 935));
            paths.push(new cc.Vec2(437, 975));
            paths.push(new cc.Vec2(433, 1032));
            paths.push(new cc.Vec2(432, 1071));
            paths.push(new cc.Vec2(431, 1108));
            paths.push(new cc.Vec2(432, 1132));
            paths.push(new cc.Vec2(433, 1138));
            paths.push(new cc.Vec2(433, 1139));
            paths.push(new cc.Vec2(433, 1139));
            paths.push(new cc.Vec2(436, 1133));
            paths.push(new cc.Vec2(443, 1110));
            paths.push(new cc.Vec2(451, 1092));
            paths.push(new cc.Vec2(461, 1061));
            paths.push(new cc.Vec2(471, 1033));
            paths.push(new cc.Vec2(483, 992));
            paths.push(new cc.Vec2(496, 953));
            paths.push(new cc.Vec2(504, 920));
            paths.push(new cc.Vec2(512, 884));
            paths.push(new cc.Vec2(517, 858));
            paths.push(new cc.Vec2(519, 843));
            paths.push(new cc.Vec2(522, 833));
            paths.push(new cc.Vec2(522, 831));
            paths.push(new cc.Vec2(522, 830));
            paths.push(new cc.Vec2(522, 830));
            paths.push(new cc.Vec2(522, 832));
            paths.push(new cc.Vec2(522, 841));
            paths.push(new cc.Vec2(519, 872));
            paths.push(new cc.Vec2(517, 918));
            paths.push(new cc.Vec2(516, 958));
            paths.push(new cc.Vec2(513, 1025));
            paths.push(new cc.Vec2(513, 1073));
            paths.push(new cc.Vec2(518, 1134));
            paths.push(new cc.Vec2(521, 1170));
            paths.push(new cc.Vec2(528, 1211));
            paths.push(new cc.Vec2(533, 1231));
            paths.push(new cc.Vec2(534, 1237));
            paths.push(new cc.Vec2(535, 1238));
            paths.push(new cc.Vec2(535, 1238));
            paths.push(new cc.Vec2(535, 1236));
            paths.push(new cc.Vec2(537, 1229));
            paths.push(new cc.Vec2(543, 1197));
            paths.push(new cc.Vec2(547, 1171));
            paths.push(new cc.Vec2(553, 1130));
            paths.push(new cc.Vec2(560, 1078));
            paths.push(new cc.Vec2(567, 1036));
            paths.push(new cc.Vec2(573, 975));
            paths.push(new cc.Vec2(578, 935));
            paths.push(new cc.Vec2(583, 888));
            paths.push(new cc.Vec2(586, 847));
            paths.push(new cc.Vec2(589, 823));
            paths.push(new cc.Vec2(593, 805));
            paths.push(new cc.Vec2(594, 797));
            paths.push(new cc.Vec2(594, 795));
            paths.push(new cc.Vec2(594, 795));
            paths.push(new cc.Vec2(594, 795));
            paths.push(new cc.Vec2(594, 795));
            paths.push(new cc.Vec2(594, 801));
            paths.push(new cc.Vec2(594, 817));
            paths.push(new cc.Vec2(591, 854));
            paths.push(new cc.Vec2(590, 908));
            paths.push(new cc.Vec2(589, 950));
            paths.push(new cc.Vec2(588, 1005));
            paths.push(new cc.Vec2(588, 1045));
            paths.push(new cc.Vec2(590, 1096));
            paths.push(new cc.Vec2(595, 1135));
            paths.push(new cc.Vec2(598, 1154));
            paths.push(new cc.Vec2(601, 1169));
            paths.push(new cc.Vec2(603, 1173));
            paths.push(new cc.Vec2(603, 1173));
            paths.push(new cc.Vec2(603, 1173));
            paths.push(new cc.Vec2(603, 1170));
            paths.push(new cc.Vec2(604, 1163));
            paths.push(new cc.Vec2(608, 1138));
            paths.push(new cc.Vec2(613, 1106));
            paths.push(new cc.Vec2(616, 1081));
            paths.push(new cc.Vec2(625, 1035));
            paths.push(new cc.Vec2(634, 997));
            paths.push(new cc.Vec2(642, 944));
            paths.push(new cc.Vec2(650, 907));
            paths.push(new cc.Vec2(660, 863));
            paths.push(new cc.Vec2(666, 831));
            paths.push(new cc.Vec2(670, 812));
            paths.push(new cc.Vec2(672, 795));
            paths.push(new cc.Vec2(673, 790));
            paths.push(new cc.Vec2(673, 789));
            paths.push(new cc.Vec2(673, 789));
            paths.push(new cc.Vec2(673, 789));
            paths.push(new cc.Vec2(673, 790));
            paths.push(new cc.Vec2(673, 799));
            paths.push(new cc.Vec2(673, 823));
            paths.push(new cc.Vec2(671, 848));
            paths.push(new cc.Vec2(669, 884));
            paths.push(new cc.Vec2(667, 912));
            paths.push(new cc.Vec2(666, 950));
            paths.push(new cc.Vec2(666, 990));
            paths.push(new cc.Vec2(667, 1020));
            paths.push(new cc.Vec2(672, 1060));
            paths.push(new cc.Vec2(675, 1086));
            paths.push(new cc.Vec2(678, 1114));
            paths.push(new cc.Vec2(681, 1130));
            paths.push(new cc.Vec2(683, 1135));
            paths.push(new cc.Vec2(683, 1139));
            paths.push(new cc.Vec2(683, 1139));
            paths.push(new cc.Vec2(683, 1139));
            paths.push(new cc.Vec2(683, 1139));
            paths.push(new cc.Vec2(683, 1139));
            paths.push(new cc.Vec2(683, 1139));
            paths.push(new cc.Vec2(683, 1138));
            paths.push(new cc.Vec2(683, 1138));
            paths.push(new cc.Vec2(683, 1138));
            paths.push(new cc.Vec2(683, 1138));
            paths.push(new cc.Vec2(683, 1138));
        }
        return paths;
    }
}
