import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";

const projectRoot = process.cwd();
const envFile = path.join(projectRoot, ".env");
const argv = process.argv.slice(2);
const accessKey =
	process.env.UNSPLASH_ACCESS_KEY ?? loadEnvFile(envFile).UNSPLASH_ACCESS_KEY;
const assetDir = path.join(projectRoot, "src", "content", "assets", "unsplash");
const utmSource = "qblog";
const utmMedium = "referral";
const batchLimit = readBatchLimit(argv);
const allowedPlaceholderImages = new Set([
	"../assets/cover-book.svg",
	"../assets/cover-diary.svg",
	"../assets/cover-food.svg",
	"../assets/cover-movie.svg",
	"../assets/cover-podcast.svg",
	"../assets/cover-terminal.svg",
	"../assets/spectre.png",
]);

const queryBySlug = {
	"book-non-violent": "open book reading warm light minimal",
	"book-我胆小如鼠": "novel book bedside lamp quiet reading",
	"cq-2026新年": "new year city lights warm night street",
	"cq-Arbeitsphilosophie": "focused workspace notebook keyboard coffee",
	"cq-about-me": "personal workspace camera notebook keyboard",
	"cq-be-open-minded-and-teachable": "friends dinner table warm candid conversation",
	"cq-granny": "old family photograph album warm light",
	"cq-haikou": "tropical seaside city palm trees sunny coast",
	"cq-human-perception": "person observing city lights from distance",
	"cq-null": "minimal empty room soft shadows",
	"cq-one-problem": "single notebook page on dark desk",
	"cq-q1": "morning notebook planning coffee desk",
	"cq-recent-two-week": "weekly planner notebook desk top view",
	"cq-rongjiale": "train platform dusk travel farewell atmosphere",
	"cq-summary-plan-2024": "year planning notebook calendar desk",
	"cq-unique-gift": "wrapped gift warm natural light minimal",
	"cq-意义": "quiet horizon sea contemplative mood",
	"cq-消逝": "fading sunset through window quiet room",
	"cq-近日": "rainy city window evening lights",
	"cq-近期0424": "misty river boat dawn poetic landscape",
	"cq-随笔1": "journal notebook fountain pen desk",
	"food-braised-fish": "braised fish chinese cuisine plated",
	"hello-world": "dark terminal workspace coding laptop",
	"movie-oppenheimer": "cinema projector film reel dramatic dark",
	"podcast-do-you-know-the-real-you": "podcast microphone studio headphones moody",
	"projects/about-me": "creative desk camera notebook laptop",
	"projects/qblog": "developer portfolio website laptop dark desk",
	"projects/smart-doc": "technical documentation workspace laptop notebook",
};

const fallbackQueryByTag = {
	book: "open book reading warm light",
	cq: "journal writing desk moody window light",
	food: "plated homemade dish natural light",
	movie: "cinema projector dark theater",
	podcast: "podcast studio microphone headphones",
};

if (!accessKey) {
	throw new Error(
		"Missing UNSPLASH_ACCESS_KEY. Add it to .env or export it before running this script.",
	);
}

fs.mkdirSync(assetDir, { recursive: true });

const entries = [
	...collectEntries("posts", path.join(projectRoot, "src", "content", "posts")),
	...collectEntries("projects", path.join(projectRoot, "src", "content", "projects")),
];

let processed = 0;

for (const entry of entries) {
	if (batchLimit != null && processed >= batchLimit) {
		console.log(`batch limit reached (${batchLimit}), stop here and rerun later.`);
		break;
	}

	const frontmatter = entry.data;
	if (!allowedPlaceholderImages.has(String(frontmatter.image ?? ""))) {
		console.log(`skip ${entry.slug}: image already customized`);
		continue;
	}

	const query = pickQuery(entry);
	if (!query) {
		console.log(`skip ${entry.slug}: no query available`);
		continue;
	}

	console.log(`fetch ${entry.slug}: ${query}`);
	const photo = await fetchRandomPhoto(query);
	await trackDownload(photo.links.download_location);

	const assetFileName = `${entry.slug.replaceAll("/", "-")}.jpg`;
	const assetFilePath = path.join(assetDir, assetFileName);
	await downloadPhoto(photo.urls.raw, assetFilePath);

	const nextData = {
		...frontmatter,
		image: `../assets/unsplash/${assetFileName}`,
		imageAlt: photo.alt_description || photo.description || frontmatter.title,
		imageCredit: {
			provider: "unsplash",
			photographer: photo.user.name,
			username: photo.user.username,
			profileUrl: addUtm(photo.user.links.html),
			photoUrl: addUtm(photo.links.html),
		},
	};

	entry.write(nextData);
	processed += 1;
}

console.log("Unsplash image sync complete.");

function loadEnvFile(filePath) {
	if (!fs.existsSync(filePath)) {
		return {};
	}

	return Object.fromEntries(
		fs
			.readFileSync(filePath, "utf8")
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"))
			.map((line) => {
				const separatorIndex = line.indexOf("=");
				if (separatorIndex === -1) {
					return [line, ""];
				}

				const key = line.slice(0, separatorIndex).trim();
				const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
				return [key, value];
			}),
	);
}

function readBatchLimit(args) {
	const flag = args.find((item) => item.startsWith("--limit="));
	if (!flag) {
		return null;
	}

	const value = Number.parseInt(flag.split("=", 2)[1], 10);
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`Invalid --limit value: ${flag}`);
	}

	return value;
}

function collectEntries(kind, directory) {
	return fs
		.readdirSync(directory)
		.filter((name) => name.endsWith(".mdx"))
		.sort((left, right) => left.localeCompare(right, "zh-Hans-CN"))
		.map((fileName) => {
			const filePath = path.join(directory, fileName);
			const raw = fs.readFileSync(filePath, "utf8");
			const { data, body } = splitFrontmatter(raw);
			const id = fileName.replace(/\.mdx$/i, "");
			const slug = kind === "projects" ? `projects/${id}` : id;

			return {
				kind,
				id,
				slug,
				data,
				write(nextData) {
					const serialized = serializeFrontmatter(nextData);
					fs.writeFileSync(filePath, `---\n${serialized}---\n\n${body.trim()}\n`);
				},
			};
		});
}

function splitFrontmatter(input) {
	const match = input.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

	if (!match) {
		return { data: {}, body: input.trim() };
	}

	return {
		data: yaml.load(match[1]) ?? {},
		body: match[2],
	};
}

function serializeFrontmatter(data) {
	return yaml.dump(normalizeData(data), {
		lineWidth: -1,
		noRefs: true,
		quotingType: '"',
	});
}

function normalizeData(data) {
	const normalized = { ...data };

	for (const key of ["createdAt", "updatedAt", "date"]) {
		if (normalized[key] instanceof Date) {
			normalized[key] = normalized[key].toISOString().slice(0, 10);
		}
	}

	return normalized;
}

function pickQuery(entry) {
	if (queryBySlug[entry.slug]) {
		return queryBySlug[entry.slug];
	}

	if (entry.kind === "posts") {
		for (const tag of entry.data.tags ?? []) {
			if (fallbackQueryByTag[tag]) {
				return fallbackQueryByTag[tag];
			}
		}
	}

	return "editorial photography minimal moody";
}

async function fetchRandomPhoto(query) {
	const url = new URL("https://api.unsplash.com/photos/random");
	url.searchParams.set("query", query);
	url.searchParams.set("orientation", "landscape");
	url.searchParams.set("content_filter", "high");

	const response = await fetch(url, {
		headers: {
			Authorization: `Client-ID ${accessKey}`,
			"Accept-Version": "v1",
		},
	});

	if (!response.ok) {
		const body = await response.text();
		if (response.status === 403 && body.includes("Rate Limit Exceeded")) {
			throw new Error(
				"Unsplash rate limit exceeded. Demo apps are limited to 50 API requests/hour, and this script uses 2 requests per image. Rerun later or use --limit=20 for batch imports.",
			);
		}

		throw new Error(`Unsplash random photo request failed: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

async function trackDownload(downloadLocation) {
	const response = await fetch(downloadLocation, {
		headers: {
			Authorization: `Client-ID ${accessKey}`,
			"Accept-Version": "v1",
		},
	});

	if (!response.ok) {
		console.warn(`download tracking failed: ${response.status} ${response.statusText}`);
	}
}

async function downloadPhoto(rawUrl, filePath) {
	const url = new URL(rawUrl);
	url.searchParams.set("fm", "jpg");
	url.searchParams.set("q", "82");
	url.searchParams.set("w", "1600");
	url.searchParams.set("fit", "max");

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Photo download failed: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
}

function addUtm(input) {
	const url = new URL(input);
	url.searchParams.set("utm_source", utmSource);
	url.searchParams.set("utm_medium", utmMedium);
	return url.toString();
}
