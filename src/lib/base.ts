export function withBase(path = '') {
	const base = import.meta.env.BASE_URL;
	const normalized = path.replace(/^\/+/, '');

	return normalized ? `${base}${normalized}` : base;
}

export function stripBase(pathname: string) {
	const base = import.meta.env.BASE_URL;

	if (base !== '/' && pathname.startsWith(base)) {
		const stripped = pathname.slice(base.length).replace(/^\/+/, '');
		return `/${stripped}`;
	}

	return pathname;
}
