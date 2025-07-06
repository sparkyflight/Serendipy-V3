/**
 * Parses a permission string into its components.
 *
 * @param {string} perm - The permission string in the format `namespace@path`
 *                        (e.g., `posts@read.comments` or `~posts@read.*`).
 * @returns {{ isNegated: boolean, namespace: string, path: string[] }} An object containing:
 * - `isNegated`: Whether the permission is a negator (starts with `~`)
 * - `namespace`: The top-level namespace (e.g., `posts`)
 * - `path`: The path as an array of strings (e.g., `["read", "comments"]`)
 */
const parsePerm = (
	perm: string
): {
	isNegated: boolean;
	namespace: string;
	path: string[];
} => {
	const isNegated = perm.startsWith("~");
	if (isNegated) perm = perm.slice(1);

	const [namespace, rawPath = "*"] = perm.split("@");
	const path = rawPath.split(".");
	return { isNegated, namespace, path };
};

/**
 * Checks if a user permission path matches a target permission path.
 *
 * @param {string[]} userPath - The user permission path (e.g., `["read", "*"]`)
 * @param {string[]} targetPath - The required permission path (e.g., `["read", "comments"]`)
 * @returns {boolean} True if the paths match, considering wildcards.
 *
 * Supports:
 * - `*` matches any single segment
 * - `**` matches all remaining segments
 */
const matchPath = (userPath: string[], targetPath: string[]): boolean => {
	for (let i = 0; i < Math.max(userPath.length, targetPath.length); i++) {
		const user = userPath[i];
		const target = targetPath[i];

		if (user === "**") return true;
		if (!user || !target) return false;
		if (user === "*") continue;
		if (user !== target) return false;
	}
	return userPath.length === targetPath.length;
};

/**
 * Checks if the user has the required permission.
 *
 * @param {string[]} perms - An array of permission strings (e.g., `["posts@read.*", "~posts@read.comments"]`)
 * @param {string} perm - The required permission string (e.g., `"posts@read.comments"`)
 * @returns {boolean} True if permission is granted, false otherwise.
 *
 * Rules:
 * - `~` prefix negates the permission
 * - Wildcards are supported: `*` (single level), `**` (deep)
 * - The `global` namespace applies to all other namespaces
 */
export const hasPerm = (perms: string[], perm: string): boolean => {
	const { namespace: targetNs, path: targetPath } = parsePerm(perm);
	let allow = false;

	for (const p of perms) {
		const { isNegated, namespace, path } = parsePerm(p);

		if (namespace !== targetNs && namespace !== "global") continue;
		if (matchPath(path, targetPath)) {
			if (isNegated) return false;
			allow = true;
		}
	}

	return allow;
};

/**
 * Builds a permission string from a namespace and path segments.
 *
 * @param {string} namespace - The namespace (e.g., `"posts"`)
 * @param {...string[]} path - One or more path segments (e.g., `"read"`, `"comments"`)
 * @returns {string} The constructed permission string (e.g., `"posts@read.comments"`)
 */
export const build = (namespace: string, ...path: string[]): string => {
	return `${namespace}@${path.join(".")}`;
};
