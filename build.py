"""把 templates/ 下的模板渲染成可以直接部署的静态 HTML。

网站链接：http://127.0.0.1:8123/index.html

用法：
    python build.py            渲染一次
    python build.py --watch    监听 templates/ 与 content/，改动后自动重新渲染

新增一篇文章：在 templates/posts/ 下建一个 .html，顶部写 {#meta ... #} 元数据，
剩下的（列表页、首页卡片、上一篇/下一篇）都会自动生成。

终端服务器：
    python -m http.server 8123

"""

from __future__ import annotations

import json
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

ROOT = Path(__file__).parent
TEMPLATES = ROOT / "templates"
POSTS_DIR = TEMPLATES / "posts"
CONTENT = ROOT / "content"
OUTPUT_POSTS = ROOT / "journal"

# 全站共用的常量，改一次所有页面都会跟着变
SITE = {
    "logo": "Noora Journal",
    "author": "Noora Wu",
    "author_short": "Noora",
    "email": "noora_wu@outlook.com",
    "year": 2026,
    "footer_note": "Built with care in Brisbane 🌅",
    "fonts": (
        "https://fonts.googleapis.com/css2"
        "?family=Noto+Serif+SC:wght@400;600;700"
        "&family=Source+Sans+3:wght@300;400;500;600&display=swap"
    ),
}

# 导航栏。anchor 指向首页锚点，page 指向独立页面
NAV = [
    {"key": "about", "label": "关于我", "anchor": "about"},
    {"key": "experience", "label": "成长旅程", "page": "journey.html"},
    {"key": "projects", "label": "项目作品", "page": "projects.html"},
    {"key": "journal", "label": "澳洲手札", "page": "journal.html"},
]

CATEGORIES = [
    ("study", "学业"),
    ("life", "生活"),
    ("career", "求职"),
    ("thoughts", "随想"),
]
CATEGORY_LABELS = dict(CATEGORIES)

META_RE = re.compile(r"\{#meta\s*(\{.*?\})\s*#\}", re.DOTALL)


@dataclass
class Post:
    slug: str
    title: str
    date: str
    category: str
    template: str
    tags: list[str] = field(default_factory=list)
    reading: int = 5
    pinned: bool = False
    excerpt: str = ""
    teaser: str = ""
    description: str = ""
    short_title: str = ""  # 列表页与上下篇导航用的短标题，留空则沿用 title
    grade: dict | None = None  # 课程成绩卡；学业文章可选填写
    prev: "Post | None" = None
    next: "Post | None" = None

    def __post_init__(self) -> None:
        if not self.short_title:
            self.short_title = self.title
        if self.grade is None:
            self.grade = {}

    @property
    def filename(self) -> str:
        return f"{self.slug}.html"

    @property
    def category_label(self) -> str:
        return CATEGORY_LABELS.get(self.category, self.category)

    @property
    def date_dotted(self) -> str:
        return self.date.replace("-", ".")

    @property
    def date_cn(self) -> str:
        year, month, day = self.date.split("-")
        return f"{year} 年 {int(month)} 月 {int(day)} 日"


def build_nav(
    *, on_index: bool, base: str, current: str | None, footer_visible: bool = True
) -> list[dict]:
    """同一份导航，按当前页面所在层级算出正确的相对链接。

    footer_visible=False 的页面（成长旅程会隐藏页脚，且 hash 被时间轴占用）
    把「联络我」改指向首页页脚。
    """
    items = []
    for entry in NAV:
        if "footer" in entry:
            if footer_visible:
                href = f"#{entry['footer']}"
            else:
                href = f"{base}index.html#{entry['footer']}"
        elif "page" in entry:
            href = f"{base}{entry['page']}"
        elif on_index:
            href = f"#{entry['anchor']}"
        else:
            href = f"{base}index.html#{entry['anchor']}"
        items.append(
            {"label": entry["label"], "href": href, "current": entry["key"] == current}
        )
    return items


def load_posts() -> list[Post]:
    posts: list[Post] = []
    for path in sorted(POSTS_DIR.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        match = META_RE.search(source)
        if not match:
            raise SystemExit(f"{path.name} 缺少顶部的 {{#meta ... #}} 元数据")
        try:
            meta = json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            raise SystemExit(f"{path.name} 的元数据不是合法 JSON：{exc}") from exc

        meta.pop("slug", None)  # 以文件名为准
        meta.setdefault("teaser", meta.get("excerpt", ""))
        meta.setdefault("description", meta.get("excerpt", ""))
        posts.append(Post(slug=path.stem, template=f"posts/{path.name}", **meta))

    # 新的排在前面；置顶只影响列表页，不影响上一篇/下一篇的时间顺序
    posts.sort(key=lambda p: (p.date, p.slug), reverse=True)

    for index, post in enumerate(posts):
        post.next = posts[index - 1] if index > 0 else None
        post.prev = posts[index + 1] if index + 1 < len(posts) else None
    return posts


def load_drafts() -> list[dict]:
    path = CONTENT / "drafts.json"
    if not path.exists():
        return []
    drafts = json.loads(path.read_text(encoding="utf-8"))
    for draft in drafts:
        draft["category_label"] = CATEGORY_LABELS.get(
            draft["category"], draft["category"]
        )
    return drafts


def load_projects() -> dict:
    """读取 content/projects.json —— 项目作品页的全部数据（新增项目只改这个文件）。"""
    path = CONTENT / "projects.json"
    if not path.exists():
        return {"categories": [], "projects": [], "total": 0}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"content/projects.json 不是合法 JSON（多半是少了/多了逗号或引号）：{exc}") from exc

    categories = [dict(c) for c in data.get("categories", [])]
    labels = {c["key"]: c["label"] for c in categories}
    projects = []
    for index, raw in enumerate(data.get("projects", []), start=1):
        if not raw.get("title"):
            raise SystemExit(f"content/projects.json 第 {index} 个项目缺少 title")
        if raw.get("category") not in labels:
            raise SystemExit(
                f"项目「{raw['title']}」的 category「{raw.get('category')}」不在 categories 里，"
                f"可选：{', '.join(labels)}"
            )
        project = {
            "summary": "", "tags": [], "link": "", "link_label": "查看项目",
            "image": "", "thumb_text": "", "year": "", "status": "",
        }
        project.update(raw)
        project["category_label"] = labels[project["category"]]
        if not project["thumb_text"]:
            project["thumb_text"] = project["title"][:1].upper()
        projects.append(project)

    for cat in categories:
        cat["count"] = sum(1 for p in projects if p["category"] == cat["key"])
    return {"categories": categories, "projects": projects, "total": len(projects)}


def render(env: Environment) -> None:
    posts = load_posts()
    drafts = load_drafts()

    listed = sorted(posts, key=lambda p: (p.pinned, p.date, p.slug), reverse=True)

    # 首页只放最新三张卡片，文章不够就用草稿占位
    teasers = [
        {
            "draft": False,
            "date": p.date,
            "date_dotted": p.date_dotted,
            "category_label": p.category_label,
            "title": p.title,
            "teaser": p.teaser,
            "filename": p.filename,
        }
        for p in posts[:3]
    ]
    for draft in drafts:
        if len(teasers) >= 3:
            break
        teasers.append(
            {
                "draft": True,
                "category_label": draft["category_label"],
                "title": draft["title"],
                "teaser": draft["excerpt"],
            }
        )

    env.globals["site"] = SITE
    env.globals["css_v"] = int((ROOT_CSS := (Path(__file__).parent / "css" / "style.css")).stat().st_mtime)

    (ROOT / "index.html").write_text(
        env.get_template("index.html").render(
            title="武若楠 · Noora Wu",
            description="武若楠的个人网站 — 从园艺到信息技术，从南京到布里斯班的人生旅程。",
            base="",
            home_href="#top",
            solid_header=False,
            nav=build_nav(on_index=True, base="", current=None),
            teasers=teasers,
            latest_post=posts[0] if posts else None,
            project_categories=load_projects()["categories"],
        ),
        encoding="utf-8",
    )

    timeline_path = CONTENT / "journey-timeline.json"
    timeline_data = json.loads(timeline_path.read_text(encoding="utf-8"))
    timeline_json = json.dumps(timeline_data, ensure_ascii=False)

    (ROOT / "journey.html").write_text(
        env.get_template("journey.html").render(
            title="成长旅程 · Noora Wu",
            description="武若楠的成长旅程 — 从海南园艺到深圳供应链，再到布里斯班信息技术。",
            base="",
            home_href="index.html",
            solid_header=True,
            nav=build_nav(on_index=False, base="", current="experience", footer_visible=False),
            timeline_json=timeline_json,
        ),
        encoding="utf-8",
    )

    (ROOT / "journal.html").write_text(
        env.get_template("journal.html").render(
            title="澳洲手札 · Noora Journal",
            description="澳洲手札 —— 武若楠在布里斯班的留学、生活与转行记录。",
            base="",
            home_href="index.html",
            solid_header=True,
            nav=build_nav(on_index=False, base="", current="journal"),
            posts=listed,
            drafts=drafts,
            categories=CATEGORIES,
            last_updated=posts[0].date_dotted if posts else "—",
        ),
        encoding="utf-8",
    )

    # 项目作品：从首页拆出来的独立页面
    for name, title, description, current in (
        (
            "projects.html",
            "项目作品 · Noora Wu",
            "武若楠的项目作品 —— 课程项目、个人作品与技能工具。",
            "projects",
        ),
    ):
        (ROOT / name).write_text(
            env.get_template(name).render(
                title=title,
                description=description,
                base="",
                home_href="index.html",
                solid_header=True,
                nav=build_nav(on_index=False, base="", current=current),
                **({"project_data": load_projects()} if name == "projects.html" else {}),
            ),
            encoding="utf-8",
        )

    OUTPUT_POSTS.mkdir(exist_ok=True)
    for post in posts:
        (OUTPUT_POSTS / post.filename).write_text(
            env.get_template(post.template).render(
                title=f"{post.title} · 澳洲手札",
                description=post.description,
                base="../",
                home_href="../index.html",
                solid_header=True,
                nav=build_nav(on_index=False, base="../", current="journal"),
                post=post,
            ),
            encoding="utf-8",
        )

    print(f"已生成 index.html、journey.html、journal.html、projects.html，以及 {len(posts)} 篇文章。")


def make_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(TEMPLATES),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )


def watch() -> None:
    print("监听中，改完模板保存即可（Ctrl+C 退出）")
    last: dict[Path, float] = {}
    while True:
        changed = False
        for folder in (TEMPLATES, CONTENT, Path(__file__).parent / "css"):
            if not folder.exists():
                continue
            for path in folder.rglob("*"):
                if path.is_file():
                    stamp = path.stat().st_mtime
                    if last.get(path) != stamp:
                        last[path] = stamp
                        changed = True
        if changed:
            try:
                render(make_env())
            except Exception as exc:  # 保持监听，不因为一次语法错误退出
                print(f"渲染失败：{exc}")
        time.sleep(1)


if __name__ == "__main__":
    if "--watch" in sys.argv:
        watch()
    else:
        render(make_env())
