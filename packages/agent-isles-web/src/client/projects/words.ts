const words = {
  brand:['创作岛','Creation Island'], welcome:['带一个想法来，做一件作品走。','Bring an idea. Leave with something you made.'],
  start:['阿启 · 开始创作','Aqi · Create'], projects:['拾页 · 项目与历史','Shiye · Projects & history'], files:['阿渡 · 文件与导出','Adu · Files & export'], showcase:['作品沿岸','Gallery coast'], inspiration:['灵感夹','Inspiration'],
  back:['返回小岛','Back to island'], close:['收起','Close'], expand:['专注模式','Focus'], shrink:['收起专注模式','Leave focus'], settings:['模型设置','Model settings'],
  new:['新建项目','New project'], open:['打开已有文件夹','Open existing folder'], project:['选择项目','Choose project'], title:['项目名称','Project name'], idea:['想做什么？','What would you like to make?'],
  create:['创建项目并继续','Create project & continue'], location:['默认位置：应用管理的独立项目文件夹','Default: a separate folder managed by the app'], selectLocation:['选择其他父文件夹','Choose another parent folder'],
  openHint:['打开文件夹不会安装依赖或执行命令。原文件、Git 历史和未提交改动都会保留。','Opening a folder does not install dependencies or run commands. Files, Git history and uncommitted changes stay in place.'],
  chat:['制作与修改','Create & iterate'], preview:['看看作品','Preview'], changes:['本轮实际改动','Actual changes this run'], save:['保存成果','Save achievement'], versions:['成果版本','Saved versions'],
  source:['当前项目文件','Current project files'], history:['会话历史','Conversation history'], empty:['还没有记录','No records yet'], loading:['正在读取…','Loading…'],
  running:['正在执行 · 收起面板不会停止任务','Working · Closing this panel does not stop the task'], waiting:['等待授权或补充','Waiting for approval or input'], finished:['本轮结束 · 请实际体验后再保存成果','Turn ended · Try the result before saving'], interrupted:['任务中断 · 不会自动重跑','Interrupted · Will not restart automatically'],
  stop:['停止本轮','Stop turn'], busy:['另一个任务正在执行，请等待结束。输入会保留。','Another task is active. Wait until it finishes; your input is retained.'],
  noRecipe:['未检测到支持的启动方式。可让阿启补充运行脚本或查看文件说明。','No supported start command found. Ask Aqi to add a run script or inspect the project instructions.'],
  runHint:['静态目录使用本地 HTTP 服务；Node 脚本会在本机执行。请核对命令，依赖安装由阿启按权限处理。服务需支持 PORT/HOST，Vite 会自动传入端口。','Static directories use a local HTTP server. Node scripts run on this computer. Review the command; ask Aqi to install dependencies with runtime permissions. Servers must honor PORT/HOST; Vite receives port arguments.'],
  launch:['确认命令并启动','Confirm command & start'], stopPreview:['停止预览','Stop preview'], starting:['预览启动中','Starting preview'], ready:['预览可访问 · 功能仍需实际检查','Preview reachable · Functionality still needs testing'], failed:['预览失败','Preview failed'], stopped:['预览已停止','Preview stopped'],
  current:['当前文件','Current files'], saved:['已保存成果','Saved achievement'], note:['成果说明 / 运行条件','Notes / running requirements'], saveHint:['保存当前源码与资源快照，排除凭据、Git 历史、依赖缓存和符号链接。保存不是发布。','Save a snapshot of source and assets, excluding credentials, Git history, dependency caches and symbolic links. Saving does not publish.'],
  saveDone:['这一版留下来了。','This version is saved.'], export:['导出','Export'], restore:['建立恢复副本','Create restored copy'], restoreHint:['恢复创建独立项目，不覆盖当前目录。','Restore creates a separate project and does not overwrite this directory.'],
  excluded:['未包含的文件','Excluded files'], included:['包含的文件','Included files'], exportHint:['导出选定版本。源码包需要项目本身的运行环境；只有经过检查的自包含 HTML 才能离线打开。','Export the selected version. Source archives require the project runtime; only checked self-contained HTML can open offline.'],
  build:['安装依赖并构建保存版本（独立副本）','Install dependencies & build saved version (separate copy)'], staticExport:['导出已验证静态包','Export verified static build'], buildHint:['构建会在独立副本执行 npm ci（或 npm install）和 npm run build，包括项目脚本及网络下载。不会修改原项目。','Build runs npm ci (or npm install) and npm run build in a separate copy, including project scripts and network downloads. The original project is unchanged.'],
  sourceExport:['导出源码包','Export source archive'], htmlExport:['检查并导出单文件 HTML','Check & export single HTML'], download:['下载文件','Download file'],
  display:['放入展示位','Place in gallery'], remove:['清空展示位','Clear slot'], slot:['展示位','Slot'], replace:['替换此位置的陈列（原成果保留）','Replace this display (keep the previous achievement)'],
  light:['轻量模式','Light mode'], world:['三维小岛','3D island'], reduced:['减少动态效果','Reduce motion'], legacy:['旧版互动作品','Legacy interactive works'], advanced:['高级工作台','Advanced workbench'],
  retry:['重新读取','Reload'], send:['发送给阿启','Send to Aqi'], parent:['上一级','Parent folder'], binary:['非文本内容，请查看文件','Non-text content; inspect the file'], before:['修改前','Before'], after:['修改后','After'],
  permission:['权限与附件使用下方原生输入框；失败与授权不会被角色动画替代。','Permissions and attachments are in the native composer. Runtime failures and approvals remain visible.'],
  sampleSite:['做一个社团活动网站，支持日程筛选，不需要后台报名。','Make a club event website with schedule filtering, without backend registration.'],
  sampleTool:['做一个读书记录工具，支持新增、筛选、收藏，数据保存在浏览器本地。','Make a reading tracker with add, filter and favorites, storing data locally in the browser.'],
  sampleGame:['做一个键盘和触屏都能玩的接星星小游戏，有计分、结束和重玩。','Make a catch-the-stars Web game with keyboard and touch controls, scoring, game over and restart.'],
  sampleLabel:['可选创作起点，不限制项目类型','Optional starting points, not limits on project types'],
  versionHint:['这是保存版本的独立副本预览，不是当前项目；依赖未就绪时请先恢复副本，再由阿启准备环境。','This previews a separate copy of the saved version, not the current project. If dependencies are missing, restore a copy and ask Aqi to prepare it.'],
  notifications:['任务通知','Task notifications'], help:['点击角色或下方快捷入口开始。无需走路。Esc 收起面板，不停止任务。','Click a character or shortcut below. No walking required. Esc closes panels without stopping work.'],
} as const
export type Word = keyof typeof words
export const translator = (en:boolean) => (key:Word) => words[key][en?1:0]
const errors:Record<string,[string,string]> = {
 'sensitive-export':['检测到疑似凭据，导出已停止。请删除凭据后重新保存成果。','Potential credentials detected. Export stopped. Remove credentials and save a new version.'],
 'build-required':['请先成功构建此保存版本。','Build this saved version successfully first.'],
 'no-static-build':['构建未产生受支持的静态目录，不能导出静态包。','The build did not produce a supported static directory.'],
 busy:['有任务正在运行，请等待结束。','A task is running. Wait for it to finish.'], changed:['保存期间文件发生变化，请重新保存。','Files changed while saving. Please retry.'], size:['文件超出安全处理上限，请缩小范围后重试。','Files exceed the processing limit. Reduce their size and retry.'], conflict:['记录已变化，请重新读取。','The record changed. Reload and retry.'], path:['文件超出项目范围或属于排除项。','The file is outside the project or excluded.'], empty:['项目还没有可保存的文件。','No files to save yet.'], title:['请填写有效名称。','Enter a valid name.'], recipe:['启动方式已变化，请重新读取。','The run command changed. Reload it.'], 'not-self-contained':['该成果不符合自包含单文件检查，请导出源码包。','This version did not pass the single-file self-contained check. Export source instead.'], binary:['该文件暂不支持文本预览。','Text preview is unavailable for this file.'], approval:['请确认实际启动命令。','Confirm the actual start command.'], storage:['存储失败，未确认保存成功。','Storage failed; saving is not confirmed.']
}
export function errorText(error:unknown,en:boolean) {const message=error instanceof Error?error.message:String(error);return errors[message]?.[en?1:0]??message}
