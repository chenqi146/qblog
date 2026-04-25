import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const flags = parseFlags(args);
const title = flags.positionals.join(" ").trim();

if (!title) {
	printUsageAndExit("Missing post title.");
}

const projectRoot = process.cwd();
const postsDir = path.join(projectRoot, "src", "content", "posts");
const tagsFile = path.join(projectRoot, "src", "content", "tags.json");
const today = formatDate(new Date());

const availableTags = readAvailableTags(tagsFile);
const selectedTags = normalizeTags(flags.tags, availableTags);
const slug = sanitizeSlug(flags.slug || title);
const filePath = path.join(postsDir, `${slug}.mdx`);
const defaultImage = pickDefaultImage(selectedTags);
const description = flags.description || title;
const draft = flags.published ? "false" : "true";

if (!slug) {
	printUsageAndExit("Unable to derive a valid slug from the title. Use --slug=...");
}

if (fs.existsSync(filePath)) {
	throw new Error(`Post already exists: ${path.relative(projectRoot, filePath)}`);
}

fs.mkdirSync(postsDir, { recursive: true });

const frontmatter = [
	"---",
	`title: ${JSON.stringify(title)}`,
	`description: ${JSON.stringify(description)}`,
	`image: ${JSON.stringify(defaultImage)}`,
	`createdAt: "${today}"`,
	`draft: ${draft}`,
	formatTags(selectedTags),
	"---",
	"",
	"",
].join("\n");

if (!flags.dryRun) {
	fs.writeFileSync(filePath, frontmatter);
}

const relativePath = path.relative(projectRoot, filePath);
console.log(flags.dryRun ? `dry run: ${relativePath}` : `created: ${relativePath}`);
console.log(`title: ${title}`);
console.log(`slug: ${slug}`);
console.log(`tags: ${selectedTags.join(", ")}`);
console.log(`image: ${defaultImage}`);
console.log(`draft: ${draft}`);

function parseFlags(argv) {
	const parsed = {
		description: "",
		dryRun: false,
		positionals: [],
		published: false,
		slug: "",
		tags: [],
	};

	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index];

		if (value === "--dry-run") {
			parsed.dryRun = true;
			continue;
		}

		if (value === "--published") {
			parsed.published = true;
			continue;
		}

		if (value.startsWith("--slug=")) {
			parsed.slug = value.slice("--slug=".length).trim();
			continue;
		}

		if (value === "--slug") {
			parsed.slug = (argv[index + 1] || "").trim();
			index += 1;
			continue;
		}

		if (value.startsWith("--tag=")) {
			parsed.tags.push(value.slice("--tag=".length).trim());
			continue;
		}

		if (value === "--tag") {
			parsed.tags.push((argv[index + 1] || "").trim());
			index += 1;
			continue;
		}

		if (value.startsWith("--description=")) {
			parsed.description = value.slice("--description=".length).trim();
			continue;
		}

		if (value === "--description") {
			parsed.description = (argv[index + 1] || "").trim();
			index += 1;
			continue;
		}

		parsed.positionals.push(value);
	}

	return parsed;
}

function printUsageAndExit(message) {
	if (message) {
		console.error(message);
	}

	console.error("");
	console.error('Usage: npm run new:post -- "文章标题" [--slug=my-post] [--tag=cq] [--description="摘要"] [--published] [--dry-run]');
	process.exit(1);
}

function readAvailableTags(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8")).map((item) => item.id);
}

function normalizeTags(inputTags, availableTags) {
	const nextTags = inputTags
		.flatMap((item) => item.split(","))
		.map((item) => item.trim())
		.filter(Boolean);

	const tags = nextTags.length > 0 ? [...new Set(nextTags)] : ["cq"];
	const invalidTags = tags.filter((tag) => !availableTags.includes(tag));

	if (invalidTags.length > 0) {
		throw new Error(
			`Unknown tags: ${invalidTags.join(", ")}. Available tags: ${availableTags.join(", ")}`,
		);
	}

	return tags;
}

function sanitizeSlug(input) {
	return String(input)
		.normalize("NFKC")
		.toLowerCase()
		.replace(/['"]/g, "")
		.replace(/[^\p{Letter}\p{Number}\s-]+/gu, " ")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function pickDefaultImage(tags) {
	const imageByTag = {
		book: "../assets/cover-book.svg",
		cq: "../assets/cover-diary.svg",
		food: "../assets/cover-food.svg",
		movie: "../assets/cover-movie.svg",
		podcast: "../assets/cover-podcast.svg",
	};

	for (const tag of tags) {
		if (imageByTag[tag]) {
			return imageByTag[tag];
		}
	}

	return "../assets/cover-terminal.svg";
}

function formatTags(tags) {
	if (tags.length === 0) {
		return "tags: []";
	}

	return `tags: [${tags.map((tag) => JSON.stringify(tag)).join(", ")}]`;
}

function formatDate(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
