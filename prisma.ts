import {
	applications,
	partners,
	authorized_apps,
	Prisma,
	PrismaClient,
	users,
} from "@prisma/client";
import FlakeId from "flake-idgen";
import bigunitFormat from "biguint-format";
import crypto from "crypto";

const prisma = new PrismaClient();

// Users
class Users {
	// Create a new user
	static async createUser(data: {
		name: string;
		userid: string;
		usertag: string;
		bio: string;
		avatar: string;
	}): Promise<boolean | Error> {
		try {
			await prisma.users.create({ data });
			return true;
		} catch (error) {
			return error as Error;
		}
	}

	// Get a single user with specific includes
	static async get(where: Prisma.usersWhereUniqueInput) {
		try {
			const user = await prisma.users.findUnique({
				where,
				include: {
					posts: {
						include: {
							upvotes: true,
							downvotes: true,
							comments: true,
							plugins: true,
							user: true,
						},
					},
					applications: false,
					followers: {
						include: {
							user: false,
							target: false,
						},
					},
					following: {
						include: {
							user: false,
							target: false,
						},
					},
				},
			});

			return user ?? null;
		} catch (error) {
			return null;
		}
	}

	// Find multiple users
	static async find(where: Record<string, any>) {
		return await prisma.users.findMany({
			where: {
				...where,
				state: {
					not: "BANNED",
				},
			},
			include: {
				posts: true,
				applications: false,
				followers: {
					include: {
						user: false,
						target: false,
					},
				},
				following: {
					include: {
						user: false,
						target: false,
					},
				},
			},
		});
	}

	// Update user by userid
	static async updateUser(
		userid: string,
		data: Prisma.usersUpdateInput
	): Promise<boolean | Error> {
		try {
			await prisma.users.update({
				where: { userid },
				data,
			});
			return true;
		} catch (error) {
			return error as Error;
		}
	}

	// Delete a user and associated data
	static async delete(userid: string): Promise<boolean | Error> {
		try {
			const posts = await prisma.posts.findMany({ where: { userid } });

			await Promise.all([
				prisma.applications.deleteMany({
					where: { creatorid: userid },
				}),
				prisma.comments.deleteMany({ where: { creatorid: userid } }),
				prisma.upvotes.deleteMany({ where: { userid } }),
				prisma.downvotes.deleteMany({ where: { userid } }),
				prisma.following.deleteMany({ where: { userid } }),
				prisma.following.deleteMany({ where: { targetid: userid } }),
				...posts.map((post) =>
					prisma.plugins.deleteMany({
						where: { postid: post.postid },
					})
				),
				prisma.posts.deleteMany({ where: { userid } }),
			]);

			await prisma.users.delete({ where: { userid } });

			return true;
		} catch (error) {
			return error as Error;
		}
	}

	// Follow another user
	static async follow(
		userid: string,
		targetid: string
	): Promise<boolean | Error> {
		if (userid === targetid) return false;

		try {
			const [user, target] = await Promise.all([
				prisma.users.findUnique({ where: { userid } }),
				prisma.users.findUnique({ where: { userid: targetid } }),
			]);

			if (!user || !target) return false;

			await prisma.following.create({
				data: {
					userid,
					targetid,
				},
			});

			return true;
		} catch (error) {
			return error as Error;
		}
	}

	// Unfollow a user
	static async unfollow(
		userid: string,
		targetid: string
	): Promise<boolean | Error> {
		if (userid === targetid) return false;

		try {
			await prisma.following.deleteMany({
				where: {
					userid,
					targetid,
				},
			});

			return true;
		} catch (error) {
			return error as Error;
		}
	}
}

// Posts
class Posts {
	// Create a post with plugins
	static async createPost(
		data: Prisma.postsCreateInput
	): Promise<boolean | Error> {
		try {
			await prisma.posts.create({
				data,
			});

			return true;
		} catch (err) {
			return err as Error;
		}
	}

	// Get a single post
	static async get(postid: string) {
		const post = await prisma.posts.findUnique({
			where: { postid },
			include: {
				user: true,
				comments: { include: { user: true } },
				plugins: true,
				upvotes: true,
				downvotes: true,
			},
		});

		if (!post || post.user?.state === "BANNED") return null;
		return post;
	}

	// Find posts with condition
	static async find(where: object) {
		const posts = await prisma.posts.findMany({
			where,
			include: {
				user: true,
				comments: {
					include: {
						user: true,
					},
				},
				plugins: true,
				upvotes: true,
				downvotes: true,
			},
		});

		return posts.filter((p) => p.user?.state !== "BANNED");
	}

	// List all public posts
	static async listAllPosts() {
		const posts = await prisma.posts.findMany({
			include: {
				user: true,
				comments: {
					include: {
						user: true,
					},
				},
				plugins: true,
				upvotes: true,
				downvotes: true,
			},
			orderBy: {
				createdat: "desc",
			},
		});

		return posts.filter(
			(p) => p.user?.state !== "BANNED" && p.user?.state !== "PRIVATE"
		);
	}

	// Update a post
	static async updatePost(
		postid: string,
		data: Prisma.postsUpdateInput
	): Promise<boolean | Error> {
		try {
			await prisma.posts.update({
				where: { postid },
				data,
			});
			return true;
		} catch (err) {
			return err as Error;
		}
	}

	// Get all posts from a user
	static async getAllUserPosts(userid: string) {
		const posts = await prisma.posts.findMany({
			where: { userid },
			include: {
				user: true,
				comments: {
					include: {
						user: true,
					},
				},
				plugins: true,
				upvotes: true,
				downvotes: true,
			},
		});

		return posts.filter(
			(p) => p.user?.state !== "BANNED" && p.user?.state !== "PRIVATE"
		);
	}

	// Delete a post and all associated data
	static async delete(postid: string): Promise<boolean | Error> {
		try {
			await Promise.all([
				prisma.comments.deleteMany({ where: { postid } }),
				prisma.plugins.deleteMany({ where: { postid } }),
				prisma.upvotes.deleteMany({ where: { postid } }),
				prisma.downvotes.deleteMany({ where: { postid } }),
			]);

			await prisma.posts.delete({ where: { postid } });
			return true;
		} catch (err) {
			return err as Error;
		}
	}

	// Upvote a post
	static async upvote(
		postid: string,
		userid: string
	): Promise<boolean | Error> {
		try {
			const user = await prisma.users.findUnique({ where: { userid } });
			if (!user || ["BANNED", "VOTE_BANNED"].includes(user.state)) {
				throw new Error(
					"User cannot vote for posts. Reason: Punishment"
				);
			}

			await prisma.upvotes.create({ data: { postid, userid } });
			return true;
		} catch (err) {
			return err as Error;
		}
	}

	// Downvote a post
	static async downvote(
		postid: string,
		userid: string
	): Promise<boolean | Error> {
		try {
			const user = await prisma.users.findUnique({ where: { userid } });
			if (!user || ["BANNED", "VOTE_BANNED"].includes(user.state)) {
				throw new Error(
					"User cannot vote for posts. Reason: Punishment"
				);
			}

			await prisma.downvotes.create({ data: { postid, userid } });
			return true;
		} catch (err) {
			return err as Error;
		}
	}

	// Delete vote on a post
	static async unvote(
		postid: string,
		userid: string
	): Promise<boolean | Error> {
		try {
			const user = await prisma.users.findUnique({ where: { userid } });
			if (!user || ["BANNED", "VOTE_BANNED"].includes(user.state)) {
				throw new Error(
					"User cannot vote for posts. Reason: Punishment"
				);
			}

			await Promise.all([
				prisma.upvotes.deleteMany({ where: { postid, userid } }),
				prisma.downvotes.deleteMany({ where: { postid, userid } }),
			]);

			return true;
		} catch (err) {
			return err as Error;
		}
	}

	// Comment on a post
	static async comment(
		postid: string,
		userid: string,
		caption: string,
		image: string
	): Promise<boolean | Error> {
		try {
			const user = await prisma.users.findUnique({ where: { userid } });
			if (!user || user.state === "BANNED") {
				throw new Error(
					"User cannot comment on posts. Reason: Punishment"
				);
			}

			await prisma.comments.create({
				data: {
					postid,
					commentid: crypto.randomUUID(),
					creatorid: userid,
					caption,
					image,
				},
			});

			return true;
		} catch (err) {
			return err as Error;
		}
	}
}

// Developer Applications
class Applications {
	// Create a new application, returns token string or Error
	static async createApp(
		creatorId: string,
		name: string,
		logo: string
	): Promise<string | Error> {
		try {
			const token = crypto
				.createHash("sha256")
				.update(
					`${crypto.randomUUID()}_${crypto.randomUUID()}`.replace(
						/-/g,
						""
					)
				)
				.digest("hex");

			const flake = new FlakeId({ epoch: 1609459200000 });
			const clientId = bigunitFormat(flake.next(), "dec");
			const clientSecret = crypto.randomBytes(32).toString("hex");

			await prisma.applications.create({
				data: {
					creatorid: creatorId,
					name,
					logo,
					token,
					client_id: clientId,
					client_secret: clientSecret,
					scopes: [],
					active: true,
					permissions: ["global.*"],
				},
			});

			return token;
		} catch (err) {
			return err as Error;
		}
	}

	// Update an app by token; data is partial applications fields
	static async updateApp(
		token: string,
		data: Prisma.applicationsUpdateInput
	): Promise<boolean | Error> {
		try {
			await prisma.applications.update({
				where: { token },
				data,
			});

			return true;
		} catch (err) {
			return err as Error;
		}
	}

	// Get app by token, including owner relation
	static async get(
		token: string
	): Promise<(applications & { owner: any }) | null> {
		try {
			const app = await prisma.applications.findUnique({
				where: { token },
				include: { owner: true, authorized_users: false },
			});

			return app ?? null;
		} catch {
			return null;
		}
	}

	// Get all applications for a creator id
	static async getAllApplications(
		creatorid: string
	): Promise<(applications & { owner: any })[] | Error> {
		try {
			return await prisma.applications.findMany({
				where: { creatorid },
				include: { owner: true, authorized_users: false },
			});
		} catch (err) {
			return err as Error;
		}
	}

	// Delete an application by unique key (e.g. token or id)
	static async delete(
		where: Prisma.applicationsWhereUniqueInput
	): Promise<boolean | Error> {
		try {
			const app = await prisma.applications.findFirst({
				where,
			});

			await Promise.all([
				await prisma.applications.delete({
					where: {
						token: app.token,
					},
				}),
				await prisma.authorized_apps.deleteMany({
					where: {
						application_id: app.client_id,
					},
				}),
			]);
			return true;
		} catch (err) {
			return err as Error;
		}
	}

	static async authorizeApp(
		userId: string,
		applicationId: string,
		scopes: string[],
		expires_at: Date | null
	): Promise<string | Error> {
		try {
			const token = crypto.randomBytes(32).toString("hex");

			await prisma.authorized_apps.create({
				data: {
					user_id: userId,
					application_id: applicationId,
					token,
					scopes,
					expires_at,
				},
			});

			return token;
		} catch (err) {
			return err as Error;
		}
	}

	static async validateToken(token: string): Promise<
		| (authorized_apps & {
				application: applications;
				authorized_user: users;
		  })
		| null
	> {
		try {
			let record = await prisma.authorized_apps.findUnique({
				where: { token },
				include: {
					application: true,
					authorized_user: true,
				},
			});

			if (
				!record ||
				record.revoked_at ||
				(record.expires_at && record.expires_at < new Date())
			) {
				return null;
			}

			record.application["token"] = null;
			record.application["client_secret"] = null;

			return record;
		} catch {
			return null;
		}
	}

	static async getAuthorizedApps(
		userId: string
	): Promise<authorized_apps[] | Error> {
		try {
			return await prisma.authorized_apps.findMany({
				where: { user_id: userId },
				include: { application: true },
			});
		} catch (err) {
			return err as Error;
		}
	}

	static async revokeToken(token: string): Promise<boolean | Error> {
		try {
			await prisma.authorized_apps.update({
				where: { token },
				data: {
					revoked_at: new Date(),
				},
			});
			return true;
		} catch (err) {
			return err as Error;
		}
	}
}

// Partners
class Partners {
	// Create a new partner
	static async create(
		data: Prisma.partnersCreateInput
	): Promise<partners | Error> {
		try {
			const newPartner = await prisma.partners.create({
				data,
			});
			return newPartner;
		} catch (error) {
			return error as Error;
		}
	}

	// Get a single partner by unique fields (e.g., id)
	static async get(
		where: Prisma.partnersWhereUniqueInput
	): Promise<(partners & { links: any[] }) | null> {
		try {
			const partner = await prisma.partners.findUnique({
				where,
				include: {
					links: true,
				},
			});
			return partner ?? null;
		} catch {
			return null;
		}
	}

	// Get all partners
	static async getAllPartners(): Promise<
		(partners & { links: any[] })[] | Error
	> {
		try {
			const partnersList = await prisma.partners.findMany({
				include: {
					links: true,
				},
			});
			return partnersList;
		} catch (error) {
			return error as Error;
		}
	}

	// Update a partner by unique identifier
	static async update(
		where: Prisma.partnersWhereUniqueInput,
		data: Prisma.partnersUpdateInput
	): Promise<partners | Error> {
		try {
			const updatedPartner = await prisma.partners.update({
				where,
				data,
			});
			return updatedPartner;
		} catch (error) {
			return error as Error;
		}
	}

	// Delete a partner by unique identifier
	static async delete(
		where: Prisma.partnersWhereUniqueInput
	): Promise<boolean | Error> {
		try {
			await prisma.partners.delete({
				where,
			});
			return true;
		} catch (error) {
			return error as Error;
		}
	}
}

// Export the classes
export { prisma, Users, Posts, Applications, Partners };
