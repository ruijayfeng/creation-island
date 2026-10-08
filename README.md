# 创作岛

创作岛是一款本地 AI 陪伴式互动创作产品。用户在小岛中制作问答小游戏、互动贺卡和分支故事，预览和修改后保存版本，并导出给别人独立使用。

**当前状态：0.1.0 开发候选版已实现，已完成本机集中验收，跨设备检查待完成。** 本目录是开发主工作区；原 isles 仓库保留为来源和参考，Boss 中的旧规划作为历史材料。

## 仓库与开发起点

GitHub 仓库：[ruijayfeng/creation-island](https://github.com/ruijayfeng/creation-island)，默认分支为 `main`，公开仓库。

已导入公开 MIT 基线，三类作品的创作、编辑、版本、收藏及导出已接入。当前实现与验收状态见[开发进度](docs/progress.md)，应用操作见[使用说明](docs/user-guide.md)。

开发环境使用 Node.js `^22.19.0` 或 `>=24.0.0` 及 Corepack Yarn `4.18.0`：先运行 `corepack yarn install --immutable`，再运行 `corepack yarn dev:web`。世界导出需要 Godot，运行 `corepack yarn build:world`。macOS ARM64 候选包通过 `corepack yarn build:desktop:darwin` 生成。

集中验收包含 20 项新产品测试和 18 组真实模型场景；结构检查与人工内容质量分别记录，见 [验收记录](docs/acceptance.md)。

## 文档入口

| 文档 | 解决的问题 |
| --- | --- |
| [产品终态与交互规格](docs/product-spec.md) | 最终做成什么，界面和用户行为是什么 |
| [技术结构与实现约定](docs/architecture.md) | 数据、AI、播放器、界面和小岛如何连接 |
| [开发执行顺序](docs/implementation-plan.md) | 按什么依赖顺序实现，每一步产出什么 |
| [视觉与素材方案](docs/assets-and-visuals.md) | 视觉方向、素材制作方式、尺寸和落地位置 |
| [素材登记表](docs/asset-register.csv) | 来源、许可、采用状态及后续归档 |
| [统一测试与交付](docs/testing-and-release.md) | 整体开发完成后怎样测试、修复和确认交付 |
| [源码基线与导入](docs/source-baseline.md) | 从哪里开始，怎样保留来源并保护现有文档 |
| [开发进度](docs/progress.md) | 当前完成到哪里，剩余项和问题是什么 |

开始开发时依次阅读产品规格、源码基线和开发执行顺序。实施某个模块时再读取对应技术或素材章节。开发约定见 [AGENTS.md](AGENTS.md)。

## 已确定的交付范围

本次交付 macOS Apple Silicon 本地桌面应用，内置运行环境，用户通过向导配置自己的模型服务。三种作品共用创作、修改、收藏、版本和导出流程。保留小岛与伙伴，增加作品展示，并提供轻量入口。

成果支持独立可玩的 HTML 和可继续编辑的 `.isle.json` 作品包。公网发布、账号同步、其他平台和任意代码生成不属于本次交付。

## 开发与测试原则

按用户最新要求，先完成整体开发，再统一测试和修复 bug。开发中只做必要的构建、启动和当前连接点检查；运行时校验、错误处理和版本保护在实现功能时一并做好。详细执行方式统一维护在测试文档。

本目录不安排时间表，不包含简历包装任务。功能范围只在产品规格维护，实际状态只在开发进度维护。
