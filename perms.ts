/**
 * Checks if a user has a permission
 * @param {string[]} perms - An array of permissions
 * @param {string} perm - The permission to check
 * @returns {boolean} Whether the user has the permission or not
 */
export const hasPerm = (perms: string[], perm: string): boolean => {
	let perm_split = perm.replace("@", ".").split(".");
	if (perm_split.length < 2) perm_split = [perm, "*"];

	const perm_namespace = perm_split[0];
	const perm_name = perm_split.slice(1).join(".");

	let has_perm: string[] | null = null;
	let has_negator: boolean = false;
	for (const user_perm of perms) {
		if (user_perm === "global.*") return true;
		let user_perm_split = user_perm.replace("@", ".").split(".");

		if (user_perm_split.length < 2) user_perm_split = [user_perm, "*"];

		let user_perm_namespace = user_perm_split[0];
		const user_perm_name = user_perm_split.slice(1).join(".");

		if (user_perm.startsWith("~"))
			user_perm_namespace = user_perm_namespace.substring(1);

		if (
			(user_perm_namespace === perm_namespace ||
				user_perm_namespace === "global") &&
			(user_perm_name === "*" || user_perm_name === perm_name)
		) {
			has_perm = user_perm_split;

			if (user_perm.startsWith("~")) has_negator = true;
		}
	}

	return has_perm !== null && !has_negator;
};

/**
 * Builds a permission
 * @param {string} namespace - The permission's namespace
 * @param {string} subnamespace - The permission's sub-namespace (optional)
 * @param {string} perm - The permission's name
 * @returns {string} The built permission
 */
export const build = (
	namespace: string,
	subnamespace: string | null,
	perm: string
): string => {
	if (subnamespace) return `${namespace}@${subnamespace}.${perm}`;
	else return `${namespace}.${perm}`;
};
