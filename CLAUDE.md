# chidental-lab

## Conventions & decisions — read before changing UI or behavior
Naming, terminology, money rules, permissions, and architecture decisions live in
**[docs/CONVENTIONS.md](docs/CONVENTIONS.md)**. Follow it; record new decisions there.
Key rule: the UI always says **"Clinic"**, but code/DB/routes/types/permission keys stay
`customer`. End-user module guide: **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**.

## Dev server
This project runs on **http://localhost:6060** (`npm run dev`).
The port is pinned via `next dev -p 6060` in package.json — do not assume 3000.
(Avoid 5000/7000 = macOS AirPlay Receiver, and 6000 = browser-blocked X11 port.)
