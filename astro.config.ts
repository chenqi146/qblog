import fs from 'node:fs';
import path from 'node:path';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import spectre from './package/src';
import { spectreDark } from './src/ec-theme';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const owner = process.env.GITHUB_REPOSITORY_OWNER ?? '';
const isUserSite =
	owner.length > 0 &&
	repository.toLowerCase() === `${owner.toLowerCase()}.github.io`;

const cnamePath = path.resolve('./public/CNAME');
const cname = fs.existsSync(cnamePath)
	? fs.readFileSync(cnamePath, 'utf8').trim()
	: '';
const hasCustomDomain = Boolean(process.env.SITE_URL || cname);

const site =
	process.env.SITE_URL ??
	(cname ? `https://${cname}` : undefined) ??
	(owner ? `https://${owner}.github.io` : 'https://example.com');
const base =
	!hasCustomDomain && repository && !isUserSite
		? `/${repository}`
		: undefined;

const config = defineConfig({
	site,
	base,
	output: 'static',
	trailingSlash: 'always',
	integrations: [
		expressiveCode({
			themes: [spectreDark],
		}),
		mdx(),
		sitemap(),
		spectre({
			name: 'CQ',
			themeColor: '#1c2a1f',
			openGraph: {
				home: {
					title: 'Black Joker',
					description:
						"Hi, I'm CQ. Software developer passionate about hiking, camping, photography, reading and cinema. Welcome to my personal space.",
				},
				blog: {
					title: 'Blog',
					description: '文章、随笔、阅读笔记与生活记录。',
				},
				projects: {
					title: 'Projects',
					description: '个人项目与长期维护的实践记录。',
				},
			},
			giscus: false,
		}),
	],
});

export default config;
