# 历史教学包

这里保存历次教学包、学生起点和实际试做交付的公开脱敏派生内容。相同内容只存一份，每个版本有独立文件路径映射。查看 [index.json](index.json) 选择版本，再到 `packages/<版本标识>/manifest.json` 查看包含文件、排除原因和内嵌包关联。

历史源包的 SHA256 只标识当时的本地输入；它不校验公开脱敏副本。公开对象的 `sha256` 和 `bytes` 才描述发布内容。原有校验文件因脱敏已不适用，恢复时生成新的 `PUBLICATION-MANIFEST.json`。

从仓库根目录检查所有历史对象：

```sh
python3 history/tools/manage.py verify
```

把某个历史版本恢复到一个不存在的新目录：

```sh
python3 history/tools/manage.py restore --package '从index.json复制版本标识' --output '../restored-course-version'
```

恢复仅复制文件并检查哈希，不安装依赖、不启动服务、不执行历史脚本。内部 ZIP 作为单独历史版本管理，使用 `nestedPackages` 的版本标识恢复。历史构建工具与依赖版本可能需要按该版说明准备。

源码、课程正文、公开配置模板、工具、实际提示词和结构化结果保留。真实环境文件、凭据、安装器、依赖/编译产物、原生桌面截图及无障碍树、未核对的图片和不透明文档不进入这份公开归档，各版本记录具体原因。正式 DOCX/PDF 的公开派生版本在主目录相应资料位置管理。

纯教学图示以同名可编辑 SVG 为依据筛选；HTML 中可核对的图像转成旁边 `__archive_images__` 资源复用，无法核对的内嵌像素显示隐私移除提示。不能把这份脱敏归档描述为未经修改的原始取证材料。

维护者修改历史对象完成脱敏后，需要重算内容地址与映射，再校验：

```sh
python3 history/tools/manage.py finalize --sanitization-reviewed
python3 history/tools/manage.py verify
```

`--sanitization-reviewed` 代表维护者已完成内容审核；脚本只更新哈希，不负责判断秘密或个人资料。禁止以 `finalize` 成功替代内容审查。
