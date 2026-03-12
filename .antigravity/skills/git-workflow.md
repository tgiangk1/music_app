---
name: Git Workflow
description: Branch naming, commit convention, and PR workflow for music-app
---

# Git Workflow Skill — Music App

## Branch Naming

```
{type}/{scope}-{mô tả ngắn}
```

### Types

| Prefix      | Mục đích                |
|-------------|-------------------------|
| `feature/`  | Tính năng mới           |
| `fix/`      | Sửa bug                 |
| `refactor/` | Cải thiện code          |
| `chore/`    | Config, deps, tooling   |
| `docs/`     | Tài liệu               |

### Scopes (music-app specific)

| Scope      | Phạm vi                              |
|------------|---------------------------------------|
| `player`   | Audio player, playback controls       |
| `playlist` | Tạo/sửa/xóa playlist                 |
| `track`    | Upload, metadata, streaming           |
| `search`   | Tìm kiếm bài hát, artist             |
| `auth`     | Đăng nhập, đăng ký, session          |
| `library`  | Thư viện cá nhân, favorites          |
| `ui`       | Components, layout, styling          |
| `api`      | REST endpoints, middleware            |
| `db`       | Schema, migrations, queries           |

### Ví dụ

```
feature/player-add-shuffle-mode
feature/playlist-create-and-reorder
fix/player-audio-not-resume-after-pause
fix/auth-token-expired-not-redirect
refactor/track-upload-stream-optimization
chore/update-audio-dependencies
docs/api-streaming-endpoint
```

## Commit Message (Conventional Commits)

```
{type}({scope}): {mô tả ngắn, tiếng Anh, động từ nguyên thể}
```

### Ví dụ

```
feat(player): add shuffle and repeat mode
feat(playlist): implement drag-and-drop reorder
fix(player): resolve audio not resuming after tab switch
fix(auth): redirect to login when token expires
refactor(track): optimize streaming with chunked upload
chore(deps): upgrade howler.js to v2.2.4
docs(api): add streaming endpoint documentation
```

## Rules

### Bắt buộc

- **KHÔNG** commit thẳng lên `main`
- **KHÔNG** stage: `.env`, `.env.*`, `node_modules/`, `dist/`, `build/`, `*.log`, `.DS_Store`
- Commit nhỏ, mỗi commit = 1 việc rõ ràng
- Không dùng message mơ hồ: `"fix"`, `"update"`, `"wip"`, `"test"`

### Workflow chuẩn

1. Tạo branch từ `main`
2. Code → commit thường xuyên (không để quá lớn)
3. Push branch lên origin
4. Tạo PR với title: `[{scope}] {mô tả}`

### PR Title Format

```
[{scope}] {mô tả ngắn}
```

#### Ví dụ

```
[player] Add shuffle and repeat mode
[auth] Fix token expiry redirect
[playlist] Implement drag-and-drop reorder
```

## Không tự động làm — hỏi trước

- Merge branch
- Delete branch
- Force push (`git push --force`)
- Reset commit đã push

## Sau mỗi lần push

Luôn hiển thị:

- Tên branch vừa push
- Danh sách commits trong branch
- Link GitHub để tạo PR
