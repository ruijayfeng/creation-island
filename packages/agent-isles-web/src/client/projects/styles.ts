export const islandStyles = `

.ci-island{position:absolute;inset:0;color:#24352f;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#c5ddd2;pointer-events:auto}
.ci-island *{box-sizing:border-box}.ci-island button,.ci-island input,.ci-island textarea,.ci-island select{font:inherit}
.ci-island button{border:1px solid #bdc9c1;border-radius:10px;padding:9px 13px;background:#fffdf7;color:#24352f;cursor:pointer;min-height:40px}
.ci-island button:hover{background:#e7eee6}.ci-island button:disabled{opacity:.5;cursor:default}
.ci-island :is(button,input,textarea,select,summary):focus-visible{outline:3px solid #c86b42;outline-offset:2px}.ci-island a{color:#22675b}
[data-agent-isles-town] [data-slot="sidebar"]{display:none!important}
/* The fixed runtime's stats entry remains available in user-selected focus mode.
   Target that entry only; approvals, questions and other composer docks stay intact. */
[data-agent-isles-town]:not([data-creation-focus]) [data-slot="conversation.composer.dock"]>._tUC3G_root{display:none}
.ci-island .ci-greeting-close{position:absolute;right:8px;top:6px;padding:0;width:28px;min-height:28px;border:0;background:transparent;color:#687961}
.ci-world{position:absolute;inset:0;width:100%;height:100%;border:0}
.ci-top{position:absolute;inset:20px 24px auto;display:flex;gap:8px;justify-content:space-between;align-items:flex-start;z-index:6;pointer-events:none}
.ci-top>div{display:flex;gap:8px;min-width:0;flex-wrap:wrap}.ci-top button{pointer-events:auto;box-shadow:0 3px 14px #17392c18;max-width:55vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid #ffffff66;background:#234d41ee;color:#fffdf1}
.ci-top button:hover{background:#306351}.ci-project-chip span{margin-right:8px;color:#ebc995}
.ci-top .ci-task-chip{font-size:12px;display:flex;align-items:center;gap:7px;background:#fffdf1ed;color:#354c40}.ci-task-chip i{width:7px;height:7px;border-radius:50%;background:#7d9274;flex:none}.ci-task-chip.needs-input i{background:#c86b42}
.ci-map-control{position:absolute;right:24px;bottom:22px;z-index:26}.ci-map-control>button{box-shadow:0 4px 20px #17392c22;background:#fffdf1f5;border-color:#ffffff88;border-radius:24px}
.ci-map{position:absolute;right:0;bottom:52px;width:284px;max-width:calc(100vw - 32px);padding:18px;background:#fffdf4;border:1px solid #b8c7b6;border-radius:16px;box-shadow:0 12px 48px #17392c33}
.ci-map p{margin:5px 0 12px}.ci-map button{display:block;text-align:left;width:100%;border:0;border-radius:6px;margin:2px 0}.ci-map button span,.ci-map button small{display:block}.ci-map button small{font-size:12px;color:#687a65}
.ci-island-greeting{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);width:min(530px,calc(100% - 180px));display:flex;align-items:center;gap:18px;padding:18px 24px;background:#fffdf2f2;border:1px solid #f7f6e6;border-radius:20px;box-shadow:0 8px 32px #17392c22;z-index:5}
.ci-island-greeting>img{width:64px;height:78px;object-fit:contain;flex:none}.ci-island-greeting strong{font-size:16px;font-weight:500}.ci-island-greeting p{font-size:12px;color:#66765d;margin:6px 0 10px}
.ci-light{position:absolute;inset:100px 5% 100px;display:flex;align-content:center;align-items:center;justify-content:center;gap:20px;flex-wrap:wrap}.ci-light h1,.ci-light>p{width:100%;text-align:center;margin:0}.ci-light button{display:grid;gap:12px;justify-items:center}.ci-light img{width:80px;height:80px;object-fit:contain}
.ci-panel{position:absolute;top:84px;right:24px;bottom:80px;width:min(480px,40vw);min-width:360px;background:#fffdf6;border:1px solid #e1e1ce;border-radius:18px;box-shadow:0 14px 48px #183a3930;z-index:20;display:flex;flex-direction:column;overflow:hidden}
.ci-panel.encounter{top:auto;left:50%;right:auto;transform:translateX(-50%);bottom:26px;width:min(600px,calc(100% - 170px));max-height:58svh;min-width:0}
.ci-panel.result{width:min(960px,68vw)}.ci-panel.image-editor{width:min(800px,58vw)}.ci-panel.focus{inset:8px;transform:none;width:auto;max-height:none;min-width:0;z-index:30}
.ci-panel>header{display:flex;gap:12px;align-items:center;padding:14px 18px;border-bottom:1px solid #e7e7d8;background:#f8f5e9;flex:none}
.ci-panel>header img{width:45px;height:58px;object-fit:contain}.ci-panel>header div{flex:1;min-width:0}.ci-panel>header strong,.ci-panel>header small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ci-panel>header small{font-size:11px;color:#6b7863}.ci-panel>header .ci-place{color:#a56d43;letter-spacing:.08em}
.ci-panel>header .ci-icon-button{width:36px;height:36px;min-height:36px;padding:0;font-size:22px;border:0;background:transparent}
.ci-island .ci-back-step{text-align:left;padding:5px 18px;border:0;border-radius:0;min-height:32px;background:#f3f2e8;color:#556a56;font-size:12px;flex:none}
.ci-body{padding:18px 22px;overflow:auto;min-height:0;flex:1;overscroll-behavior:contain}.ci-body h2{font-size:22px;font-weight:600;margin:10px 0}.ci-body h3{font-size:16px}
.ci-body input,.ci-body textarea,.ci-body select{width:100%;padding:10px;border:1px solid #acbfb2;border-radius:8px;background:white;color:#24352f}.ci-body label{display:grid;gap:6px;margin:12px 0}.ci-body textarea{min-height:100px;resize:vertical}
.ci-dialogue-line{font-size:16px;line-height:1.8;margin:0 0 18px}.ci-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.ci-primary{background:#22675b!important;color:#fffdf4!important;border-color:#22675b!important}
.ci-list{display:grid;gap:8px;margin:12px 0}.ci-item{padding:16px;background:#f6f5eb;border:1px solid #e4e4d3;border-radius:12px;margin:12px 0}.ci-item p{margin:8px 0}.ci-muted{font-size:12px;color:#687961;overflow-wrap:anywhere}
.ci-body details{margin:12px 0}.ci-body summary,.ci-chat-tools summary{cursor:pointer;min-height:38px;display:flex;align-items:center;gap:8px;font-size:13px;color:#52684f;list-style:none}
.ci-body summary::before,.ci-chat-tools summary::before{content:'›';font-size:20px;line-height:1}.ci-body details[open]>summary::before,.ci-chat-tools details[open]>summary::before{transform:rotate(90deg)}
.ci-body details>details{padding-left:12px}.ci-secondary{border-top:1px solid #e5e6d8;padding-top:8px}.ci-island .ci-text-button{border:0;background:transparent;color:#22675b;padding:10px 0;text-align:left;display:block}
.ci-island .ci-book-row{text-align:left;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-left:4px solid #b69b72;background:#fffdf8}.ci-book-row span{min-width:0;overflow-wrap:anywhere}.ci-book-row small{font-size:11px;color:#687961;flex:none;max-width:45%}
.ci-island .ci-book-row[aria-current=true],.ci-island .ci-book-row[aria-pressed=true]{border-left-color:#22675b;background:#eaf0e3}
.ci-error{padding:10px 16px;background:#ffebe4;border-left:3px solid #a44528;overflow-wrap:anywhere;font-size:13px}.ci-status{padding:8px 18px;background:#edf1e6;display:flex;gap:8px;align-items:center;font-size:12px;flex:none}.ci-status span{flex:1}.ci-status button{padding:4px 8px;min-height:32px}
.ci-panel .town-native-chat-seat{flex:1;min-height:180px;width:100%;position:relative}.ci-chat-tools{padding:8px 16px;display:flex;align-items:flex-start;gap:12px;flex:none;position:relative}.ci-chat-tools>button{padding:6px 10px;font-size:13px;min-height:34px}.ci-chat-tools summary{font-size:12px;min-height:34px}
.ci-chat-tools>details{flex:1;min-width:0}.ci-tool-menu{padding:6px 0;display:grid;grid-template-columns:1fr 1fr;gap:4px;max-height:160px;overflow:auto}.ci-tool-menu button{text-align:left;border:0;font-size:12px;min-height:34px;padding:6px}

.ci-context{font-size:11px;color:#687961;margin:0;padding:0 18px;max-height:30%;overflow:auto}.ci-context summary{cursor:pointer}.ci-idea{padding:12px 18px;background:#fff5d9;font-size:13px;max-height:32%;overflow:auto}.ci-idea small{color:#786947;font-size:11px}.ci-idea p{margin:6px 0}
.ci-preview{width:100%;height:50vh;border:1px solid #c6d2c9;background:white;border-radius:8px}.ci-preview-footer{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 18px;border-top:1px solid #e0e4d5;background:#f8f5e9;flex:none}.ci-preview-footer button{font-size:13px;min-height:36px;padding:6px 10px}.ci-preview-caption{display:flex;align-items:baseline;gap:12px;justify-content:space-between}.ci-preview-caption span{font-size:12px;color:#687961}
.ci-preview-workspace{display:grid;grid-template-columns:minmax(0,1fr);height:52vh;gap:12px}.ci-preview-workspace.with-chat{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}.ci-preview-workspace .ci-preview{height:100%}.ci-preview-chat{height:100%;display:flex;flex-direction:column;margin:0}.ci-preview-chat h3{font-size:14px;margin:0 0 8px}.ci-preview-capture-area{min-width:0;height:100%}.ci-preview-capture-area iframe{display:block}
.ci-code{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf1e8;padding:12px;font:12px/1.6 ui-monospace,monospace;max-height:45vh;overflow:auto}.ci-diff{display:grid;gap:12px}.ci-image{max-width:100%;max-height:60vh;object-fit:contain}.ci-version-icon{background:#e2eade;border-radius:8px;padding:32px;font-size:20px;color:#22675b;text-align:center}
.ci-notice{position:absolute;left:20px;bottom:80px;padding:12px;background:#fffdf7;max-width:320px;border-radius:10px;z-index:25;font-size:13px}.ci-notice button{display:block;margin-top:6px;padding:4px 8px;min-height:32px}.ci-island .town-panel{z-index:40}.ci-island pre{margin:8px 0}
.ci-check{display:flex!important;align-items:center;gap:10px}.ci-check input[type=checkbox]{width:auto;flex:none}.ci-todo{display:flex;gap:6px;margin:8px 0}.ci-todo input[type=checkbox]{width:22px;flex:none}.ci-todo input{min-width:0}
.ci-cover{width:100%;aspect-ratio:16/9;object-fit:contain;background:#e2eade;border-radius:10px}.ci-annotation-scroll{overflow:auto;max-height:60vh}.ci-annotation-image{position:relative;touch-action:none;user-select:none;line-height:0}.ci-annotation-image img{display:block;width:100%;height:auto}.ci-box{position:absolute;border:2px solid #c24f26;color:white;background:#c24f2620;font:bold 16px/1.2 system-ui;pointer-events:none}.ci-panel label{overflow-wrap:anywhere}.ci-capturing .ci-notice{visibility:hidden}
.ci-starter-page{padding:22px;background:#f6f2df;border:1px solid #ded7bd;border-radius:2px 14px 14px 2px;border-left:5px solid #a58d69}.ci-page-number,.ci-page-turn{display:flex;justify-content:space-between;gap:8px}.ci-page-number{font-size:11px;letter-spacing:.1em;color:#877c5a}.ci-starter-page h2{margin:20px 0 8px}.ci-starter-page>p{font-size:14px;line-height:1.8}.ci-page-turn{margin-top:20px;padding-top:14px;border-top:1px solid #dcd4b9}.ci-page-turn button{border:0;font-size:12px;background:transparent;padding:5px}.ci-starter-demo{margin-top:18px}.ci-starter-demo iframe{height:50vh}
.ci-slot-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ci-slot-row span{min-width:65px;font-size:12px}.ci-slot-row button{font-size:12px;min-height:36px;padding:6px 8px}
.ci-reduced *{animation:none!important;transition:none!important}
@media(max-width:800px){
 .ci-panel,.ci-panel.result,.ci-panel.image-editor{top:82px;right:10px;left:10px;bottom:78px;width:auto;min-width:0}.ci-panel.encounter{inset:auto 10px 78px;transform:none;width:auto;max-height:62svh}.ci-panel.focus{inset:4px;max-height:none}
 .ci-top{inset:12px 10px auto;gap:4px}.ci-top>div{gap:4px}.ci-top button{font-size:12px;padding:7px 10px;min-height:36px}.ci-top .ci-task-chip{font-size:10px}
 .ci-map-control{bottom:16px;right:12px}.ci-map-control>button{font-size:12px;padding:8px 12px}.ci-island-greeting{left:10px;bottom:80px;transform:none;width:calc(100% - 20px);padding:14px 16px;gap:12px}.ci-island-greeting>img{width:44px;height:58px}.ci-island-greeting strong{font-size:14px}.ci-island-greeting p{font-size:11px}
 .ci-panel>header{padding:10px 14px;gap:8px}.ci-panel>header img{width:36px;height:46px}.ci-panel>header strong{font-size:14px}.ci-panel>header small{font-size:10px}.ci-body{padding:16px}.ci-dialogue-line{font-size:15px}
 .ci-book-row small{max-width:40%}.ci-preview-workspace.with-chat{display:flex;flex-direction:column;height:auto}.ci-preview-workspace.with-chat .ci-preview{height:40vh}.ci-preview-chat{height:380px}
 .ci-starter-page{padding:16px}.ci-chat-tools{gap:6px}.ci-chat-tools summary{font-size:11px}.ci-context{max-height:20%}.ci-notice{bottom:80px;left:10px;max-width:calc(100% - 20px)}.ci-preview-caption{display:block}
}
@media(prefers-reduced-motion:reduce){.ci-island *{animation:none!important;transition:none!important}}

`
