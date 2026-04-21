import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";

const sourceRoot = path.resolve(process.cwd(), process.argv[2] ?? "../blog");
const sourcePostsDir = path.join(sourceRoot, "source", "_posts");
const sourceAboutFile = path.join(sourceRoot, "source", "about", "index.md");
const sourceCnameFile = path.join(sourceRoot, "source", "CNAME");
const sourceProjectsFile = path.join(sourceRoot, "source", "_data", "projects.json");
const targetPostsDir = path.resolve(process.cwd(), "src/content/posts");
const targetTagsFile = path.resolve(process.cwd(), "src/content/tags.json");
const targetAboutFile = path.resolve(process.cwd(), "src/content/other/about.mdx");
const targetCnameFile = path.resolve(process.cwd(), "public/CNAME");
const targetProjectsDir = path.resolve(process.cwd(), "src/content/projects");
const defaultImage = "../assets/cover-terminal.svg";
const postImageByTag = {
	book: "../assets/cover-book.svg",
	cq: "../assets/cover-diary.svg",
	food: "../assets/cover-food.svg",
	movie: "../assets/cover-movie.svg",
	podcast: "../assets/cover-podcast.svg",
};

if (!fs.existsSync(sourcePostsDir)) {
	throw new Error(`Hexo posts directory not found: ${sourcePostsDir}`);
}

function splitFrontmatter(input) {
	const match = input.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

	if (!match) {
		return { data: {}, body: input.trim() };
	}

	return {
		data: yaml.load(match[1]) ?? {},
		body: match[2].trim(),
	};
}

function normalizeTags(rawTags) {
	if (rawTags == null || rawTags === "") {
		return [];
	}

	if (Array.isArray(rawTags)) {
		return rawTags.map((item) => String(item).trim()).filter(Boolean);
	}

	return String(rawTags)
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function stripMarkdown(input) {
	return input
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/!\[[^\]]*]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
		.replace(/^>\s?/gm, "")
		.replace(/^#+\s+/gm, "")
		.replace(/[*_~]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function inferDescription(body, title) {
	const candidates = body
		.split(/\r?\n\r?\n/)
		.map((block) => stripMarkdown(block))
		.filter(Boolean)
		.filter((block) => block !== title);

	const first = candidates[0] ?? title;
	return first.length > 96 ? `${first.slice(0, 93)}...` : first;
}

function formatDateValue(value) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid date value: ${value}`);
	}

	return date.toISOString().slice(0, 10);
}

function formatFrontmatter({
	title,
	description,
	createdAt,
	updatedAt,
	tags,
	image,
}) {
	const lines = [
		"---",
		`title: ${JSON.stringify(title)}`,
		`description: ${JSON.stringify(description)}`,
		`image: ${JSON.stringify(image)}`,
		`createdAt: ${createdAt}`,
	];

	if (updatedAt && updatedAt !== createdAt) {
		lines.push(`updatedAt: ${updatedAt}`);
	}

	lines.push("draft: false");

	if (tags.length > 0) {
		lines.push("tags:");
		for (const tag of tags) {
			lines.push(`  - ${tag}`);
		}
	} else {
		lines.push("tags: []");
	}

	lines.push("---", "");

	return lines.join("\n");
}

function pickPostImage(tags, slug) {
	for (const tag of tags) {
		if (postImageByTag[tag]) {
			return postImageByTag[tag];
		}
	}

	if (slug.startsWith("cq-")) {
		return postImageByTag.cq;
	}

	return defaultImage;
}

function slugifyProjectName(input) {
	return String(input)
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "project";
}

function toAbsoluteUrl(url, siteUrl) {
	if (!url) {
		return undefined;
	}

	if (/^https?:\/\//i.test(url)) {
		return url;
	}

	if (!siteUrl) {
		return undefined;
	}

	const legacyPostMatch = url.match(/^\.\/\d{4}\/\d{2}\/\d{2}\/([^/]+)\/?$/);

	if (legacyPostMatch) {
		return new URL(`/blog/${legacyPostMatch[1]}/`, siteUrl).toString();
	}

	return new URL(url.replace(/^\.\//, "/"), siteUrl).toString();
}

function projectIcon(link) {
	if (!link) {
		return { type: "lucide", name: "folder-git" };
	}

	if (/github\.com/i.test(link)) {
		return { type: "simple-icons", name: "github" };
	}

	return { type: "lucide", name: "earth" };
}

fs.rmSync(targetPostsDir, { recursive: true, force: true });
fs.mkdirSync(targetPostsDir, { recursive: true });

const allTags = new Set();
const files = fs
	.readdirSync(sourcePostsDir)
	.filter((name) => name.endsWith(".md"))
	.sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));

for (const fileName of files) {
	const sourceFile = path.join(sourcePostsDir, fileName);
	const raw = fs.readFileSync(sourceFile, "utf8");
	const { data, body } = splitFrontmatter(raw);
	const slug = fileName.replace(/\.md$/i, "");
	const tags = normalizeTags(data.tags);

	for (const tag of tags) {
		allTags.add(tag);
	}

	const createdAt = formatDateValue(data.date);
	const updatedAtRaw = formatDateValue(fs.statSync(sourceFile).mtime);
	const updatedAt = updatedAtRaw > createdAt ? updatedAtRaw : undefined;
	const description = inferDescription(body, String(data.title ?? slug));
	const image = pickPostImage(tags, slug);
	const frontmatter = formatFrontmatter({
		title: String(data.title ?? slug),
		description,
		createdAt,
		updatedAt,
		tags,
		image,
	});
	const targetFile = path.join(targetPostsDir, `${slug}.mdx`);

	fs.writeFileSync(targetFile, `${frontmatter}${body.trim()}\n`);
}

const serializedTags = [...allTags]
	.sort((left, right) => left.localeCompare(right, "zh-Hans-CN"))
	.map((id) => ({ id }));

fs.writeFileSync(targetTagsFile, `${JSON.stringify(serializedTags, null, 2)}\n`);

if (fs.existsSync(sourceAboutFile)) {
	const rawAbout = fs.readFileSync(sourceAboutFile, "utf8");
	const { body } = splitFrontmatter(rawAbout);
	fs.writeFileSync(targetAboutFile, `${body.trim()}\n`);
}

if (fs.existsSync(sourceCnameFile)) {
	fs.writeFileSync(targetCnameFile, `${fs.readFileSync(sourceCnameFile, "utf8").trim()}\n`);
}

if (fs.existsSync(sourceProjectsFile)) {
	const sourceSiteUrl = fs.existsSync(sourceCnameFile)
		? `https://${fs.readFileSync(sourceCnameFile, "utf8").trim()}`
		: undefined;
	const projectDate = formatDateValue(fs.statSync(sourceProjectsFile).mtime);
	const projects = JSON.parse(fs.readFileSync(sourceProjectsFile, "utf8"));

	for (const project of projects) {
		const title = String(project.name ?? "Untitled Project");
		const description = String(project.desc ?? title);
		const slug = slugifyProjectName(title);
		const link = toAbsoluteUrl(project.url, sourceSiteUrl);
		const icon = projectIcon(link);
		const frontmatterLines = [
			"---",
			`title: ${JSON.stringify(title)}`,
			`date: ${projectDate}`,
			`description: ${JSON.stringify(description)}`,
			`image: ${JSON.stringify(defaultImage)}`,
			"info:",
			`  - text: ${JSON.stringify(link ? "Open Link" : "Imported from Hexo")}`,
			...(link ? [`    link: ${JSON.stringify(link)}`] : []),
			"    icon:",
			`      type: ${JSON.stringify(icon.type)}`,
			`      name: ${JSON.stringify(icon.name)}`,
			"---",
			"",
		];

		const bodyLines = [
			description,
			"",
			"## 来源",
			"",
			"- 数据来源：旧 Hexo 博客的 `source/_data/projects.json`",
		];

		if (link) {
			bodyLines.push(`- 原始链接：${link}`);
		}

		fs.writeFileSync(
			path.join(targetProjectsDir, `${slug}.mdx`),
			`${frontmatterLines.join("\n")}${bodyLines.join("\n")}\n`,
		);
	}
}

console.log(
	`Imported ${files.length} Hexo posts, ${serializedTags.length} tags, about page, CNAME, and project data from ${sourceRoot}`,
);
