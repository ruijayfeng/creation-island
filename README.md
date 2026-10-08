# 创作岛

创作岛是以三维小岛为主界面的开放式 AI 项目创作环境。在造物台与阿启制作真实项目，由拾页找回项目和会话，由阿渡查看文件、改动与交付。支持网站、交互工具、轻量 Web 游戏及已有项目修改；其他技术栈按实际环境准备。

**当前为 0.2.0 开发候选版。** 新主流程已接通并通过本机集中检查；最终交付和未验证范围见 [开发进度](docs/progress.md) 与 [开放项目验收](docs/open-project-acceptance.md)。原三类作品数据和兼容入口保留，历史验收不代表新方向通过。

## 使用与开发

macOS Apple Silicon 桌面包内置 Node/npm、固定 Harness 运行时和岛屿资源。模型服务需自行配置。操作见 [使用说明](docs/user-guide.md) / [English guide](docs/user-guide.en.md)。

开发要求 Node.js `^22.19.0` 或 `>=24.0.0`、Corepack Yarn `4.18.0`：

```sh
corepack yarn install --immutable
corepack yarn build:world  # Godot 4.7.2 + Web export templates
corepack yarn dev:web
```

Apple Silicon 打包：`corepack yarn build:desktop:darwin`。独立解压后执行 `bash apps/desktop/verify-darwin.sh <解压目录>`；新项目的集中测试说明见验收记录。

默认新会话使用 `workspace-write + ask`，已有会话保留实际权限。模型会修改真实文件；停止、任务结束、预览可访问、保存成果是不同事实。恢复默认建立副本，成果和导出引用明确保存版本。源码包、已构建静态包与自包含单文件 HTML 分别说明运行条件。

本版本不提供默认公网部署、云同步、Apple 公证或任意技术栈一键运行承诺。预览脚本和构建是用户明确确认的本机代码执行；请核对脚本。新主流程无需进入高级工作台。

## 文档与来源

- [产品终态](docs/product-spec.md)、[体验](docs/product-experience.md)、[品牌与角色](docs/brand-and-characters.md)
- [技术结构](docs/architecture.md)、[执行边界](docs/implementation-plan.md)、[集中测试](docs/testing-and-release.md)
- [素材登记](docs/asset-register.csv)、[来源基线](docs/source-baseline.md)、[第三方声明](THIRD_PARTY_NOTICES.md)

当前仓库：[ruijayfeng/creation-island](https://github.com/ruijayfeng/creation-island)。原 isles 仅作只读参考；固定 `deepseek-harness/` 与 vendor 归档未修改。开发约定见 [AGENTS.md](AGENTS.md)。
