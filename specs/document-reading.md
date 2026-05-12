# Mini Spec: Document Reading

**Status**: in progress
**Owner**: api-web-agent
**Last updated**: 2026-05-12

---

## 愿景

让浏览器侧 agent 的文档阅读体验**接近 claude.ai / ChatGPT 的网页端**：

- 用户拖一个 docx / xlsx / pdf / 图片进来，模型立刻能讨论内容（含表格、标题层级、视觉信息）
- 多个文档/图片混合，agent 能引用具体段落 / 表格列 / 页码
- 同一个文档在多条消息复用，不重传 token
- **0 后端约束下的最佳近似**——做不到的部分（服务器 RAG）显式承认，绕开

## 现状（基线）

| 格式 | 当前路径 | 损失 |
|---|---|---|
| PDF | pdfjs 抽 text → inject 文本 | 图表/表格/复杂排版 |
| DOCX | mammoth raw text → inject | 表格/标题层级/列表 |
| XLSX | SheetJS → 单块 CSV | 多 sheet 信息混淆 |
| 图片 | **未支持** | 完全 gap |

## 目标（Phase 1 + 2 完成态）

| 格式 | 目标路径 | 体验对标 |
|---|---|---|
| **DOCX** | mammoth → HTML → Markdown，保留表格/标题/列表注入 | ≈ ChatGPT |
| **XLSX** | 多 sheet 各独立块 + metadata header + 大表分块 | ≈ ChatGPT |
| **PDF (vision model)** | Claude → `{type:"document"}` 字节直传；GPT vision → 每页 PNG → image_url | ≈ claude.ai |
| **PDF (其它 model)** | 现有 pdfjs 抽 text 路径兜底 | Kimi 级 |
| **图片** | base64 → image content block，自动选 vision model | claude.ai 同等 |
| **多文档复用** | OPFS 持久化原始字节 + 会话级附件 panel | ≈ ChatGPT files panel |

## 显式不做（Phase 3+，本 spec 不覆盖）

- **客户端 RAG**（transformers.js embedding + 向量索引 + `doc_search` 工具）—— 30MB+ 资产，长期目标
- **OCR 扫描件**（tesseract.js）—— 重，看用户需求再加
- **服务器侧文件 API**（OpenAI Files / Anthropic Files）—— 违背 0 后端原则
- **更多格式**（pptx / epub / csv）—— 暂时只做 docx/xlsx/pdf/image

## 设计约束

1. **0 后端**：所有解析、转换、持久化都在浏览器
2. **多 provider 兼容**：按 model 能力分流，不强依赖特定 provider 的 hosted file API
3. **Hybrid Pattern 1 + 3**：vision model 走原生字节（Pattern 1），其它走文本注入（Pattern 3）；同一个 UI 上层无感
4. **token 经济**：长文档优先分块/截断而非一次性灌入；持久化文件不重传

## 实施清单

### Phase 1（核心，~1.5 天）

| # | 改动 | 关键文件 |
|---|---|---|
| 1 | DOCX：mammoth.convertToHtml → turndown → Markdown 注入 | `src/runtime/doc-parsers/docx.ts` |
| 2 | XLSX：每 sheet 独立块 + 顶部 metadata + >10k 行分块 | `src/runtime/doc-parsers/xlsx.ts` |
| 3 | 图片支持：Composer 接 image/* + adapter 输出 image content block | `src/ui/chat/Composer.tsx` / `src/store/index.ts` |
| 4 | 附件 chip mime icon (📄/📝/📊/🖼) | `src/ui/chat/Composer.tsx` |
| 5 | PDF (Anthropic)：选 claude-* 时直传 `{type:"document"}` 字节 | `src/providers/anthropic.ts` / `src/store/index.ts` |
| 6 | PDF (OpenAI vision)：选 gpt-*/o*-* vision 时 pdfjs 渲染 PNG → image_url | `src/providers/openai.ts` / `src/runtime/doc-parsers/pdf.ts` |
| 7 | Model 能力探测：`isVisionCapable(model)` 路由分流 | `src/providers/preset-models.ts` |

### Phase 2（持久化 + 复用，~1.5 天）

| # | 改动 | 关键文件 |
|---|---|---|
| 8 | OPFS 持久化：上传时存原始字节，attachment 加 opfsPath | `src/runtime/opfs.ts` (新) / `src/storage/db.ts` |
| 9 | 会话级附件 panel：会话顶部 chip 区，显示所有已上传文件 | `src/ui/chat/AttachmentsBar.tsx` (新) |
| 10 | 复用机制：新消息默认勾选会话内附件，可手动取消 | `src/ui/chat/Composer.tsx` / `src/store/index.ts` |

## 验收

每个验收点 = 一个手测 + （可选）一个 vitest 用例。

### Phase 1

- [ ] 上传 docx 含 3 级标题 + 2 个表格，问"列出所有二级标题"——模型给出正确列表（验证表格/标题保留）
- [ ] 上传 3-sheet xlsx，问"哪些 sheet 含 'Revenue' 字段"——模型能区分 sheet（验证 metadata + 分块）
- [ ] 上传一张包含图表的 PDF，选 Claude，问图表趋势——模型描述图表内容（验证 Pattern 1 字节直传）
- [ ] 同 PDF 选 DeepSeek（无 vision），问相同问题——模型回答基于 text 提取（验证 Pattern 3 兜底）
- [ ] 上传一张照片，选 Claude/GPT-4o，问"图里有什么"——模型描述（验证图片 path）
- [ ] 选无 vision model + 上传图片——UI 警告"当前 model 不支持图片"

### Phase 2

- [ ] 上传一个 PDF，发 3 条消息分别问不同问题——后两条不再重传 PDF 字节（DevTools 网络面板验证）
- [ ] 关浏览器重开同会话，附件 panel 还在，原始字节从 OPFS 读出可重读
- [ ] 删除附件按钮工作，重新发消息不再带该附件

## 进展追踪

实施日志写在 commit message 里，按 Phase 1 #1 → #7 → Phase 2 顺序。完成一项更新本文件的 checkbox。

## 不确定项 / 待验证

- mammoth 转 HTML 的列表/表格嵌套深度上限
- pdfjs 渲染大 PDF（>50 页）的内存占用
- OPFS 配额（不同浏览器差异大；超额时 fallback IndexedDB blob）
- 图片在不同 vision model 上的最大尺寸 / token cost
