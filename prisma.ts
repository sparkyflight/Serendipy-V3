import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// Users
class Users {
	static async createUser(
		name: string,
		userid: string,
		usertag: string,
		bio: string,
		avatar: string
	) {
		try {
			await prisma.users.create({
				data: {
					name: name,
					userid: userid,
					usertag: usertag,
					bio: bio,
					avatar: avatar,
					badges: [],
				},
			});

			return true;
		} catch (error) {
			return error;
		}
	}

	static async get(data: any) {
		const doc = await prisma.users.findUnique({
			where: {
				...data,
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

		if (!doc) return null;
		else return doc;
	}

	static async find(data: any) {
		const docs = await prisma.users.findMany({
			where: {
				...data,
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

		return docs;
	}

	static async updateUser(id: string, data: object) {
		try {
			await prisma.users.update({
				where: {
					userid: id,
				},
				data: data,
			});

			return true;
		} catch (err) {
			return err;
		}
	}

	static async delete(id: string) {
		try {
			await prisma.applications.deleteMany({
				where: {
					creatorid: id,
				},
			});

			await prisma.comments.deleteMany({
				where: {
					creatorid: id,
				},
			});

			await prisma.upvotes.deleteMany({
				where: {
					userid: id,
				},
			});

			await prisma.downvotes.deleteMany({
				where: {
					userid: id,
				},
			});

			(await prisma.posts.findMany({})).map(async (post) => {
				await prisma.plugins.deleteMany({
					where: {
						postid: post.postid,
					},
				});
			});

			await prisma.posts.deleteMany({
				where: {
					userid: id,
				},
			});

			await prisma.following.deleteMany({
				where: {
					userid: id,
				},
			});

			await prisma.following.deleteMany({
				where: {
					targetid: id,
				},
			});

			await prisma.users.delete({
				where: {
					userid: id,
				},
			});

			return true;
		} catch (err) {
			return err;
		}
	}

	static async follow(UserID: string, Target: string) {
		try {
			const user = await prisma.users.findUnique({
				where: {
					userid: UserID,
				},
			});

			const target = await prisma.users.findUnique({
				where: {
					userid: Target,
				},
			});

			if (!user || !target) return false;
			else if (user.userid === target.userid) return false;
			else {
				await prisma.following.create({
					data: {
						userid: UserID,
						targetid: Target,
					},
				});

				return true;
			}
		} catch (err) {
			return err;
		}
	}

	static async unfollow(UserID: string, Target: string) {
		try {
			const user = await prisma.users.findUnique({
				where: {
					userid: UserID,
				},
			});

			const target = await prisma.users.findUnique({
				where: {
					userid: Target,
				},
			});

			if (!user || !target) return false;
			else if (user.userid === target.userid) return false;
			else {
				await prisma.following.deleteMany({
					where: {
						userid: UserID,
						targetid: Target,
					},
				});

				return true;
			}
		} catch (err) {
			return err;
		}
	}
}

// Posts
class Posts {
	static async createPost(
		userid: string,
		caption: string,
		type: number,
		image: string,
		plugins: any[]
	) {
		try {
			const postid = crypto.randomUUID();

			await prisma.posts.create({
				data: {
					userid: userid,
					caption: caption,
					type: type,
					image: image,
					postid: postid,
				},
			});

			plugins.map(async (p) => {
				await prisma.plugins.create({
					data: {
						postid: postid,
						type: p.type,
						href: p.href || null,
						jsonData: p.jsonData,
					},
				});
			});

			return true;
		} catch (err) {
			return err;
		}
	}

	static async get(PostID: string) {
		let post = await prisma.posts.findUnique({
			where: {
				postid: PostID,
			},
			include: {
				user: true,
				comments: {
					include: {
						user: true,
					},
				},
				plugins: true,
				upvotes: {
					include: {
						post: false,
					},
				},
				downvotes: {
					include: {
						post: false,
					},
				},
			},
		});

		if (post.user.state === "BANNED") return null;
		else if (post) return post;
		else return null;
	}

	static async find(data: object) {
		const docs = await prisma.posts.findMany({
			where: data,
			include: {
				user: true,
				comments: true,
				plugins: true,
				upvotes: {
					include: {
						post: false,
					},
				},
				downvotes: {
					include: {
						post: false,
					},
				},
			},
		});

		return docs.filter((p) => p.user.state != "BANNED");
	}

	static async listAllPosts() {
		const docs = await prisma.posts.findMany({
			include: {
				user: true,
				comments: true,
				plugins: true,
				upvotes: {
					include: {
						post: false,
					},
				},
				downvotes: {
					include: {
						post: false,
					},
				},
			},
			orderBy: {
				createdat: "desc",
			},
		});

		return docs.filter((p) => p.user.state != "BANNED" || "PRIVATE");
	}

	static async updatePost(id: string, data: any) {
		try {
			await prisma.posts.update({
				where: {
					postid: id,
				},
				data: data,
			});

			return true;
		} catch (err) {
			return err;
		}
	}

	static async getAllUserPosts(UserID: string) {
		const docs = await prisma.posts.findMany({
			where: { userid: UserID },
			include: {
				user: true,
				comments: true,
				plugins: true,
				upvotes: {
					include: {
						post: false,
					},
				},
				downvotes: {
					include: {
						post: false,
					},
				},
			},
		});
        
		return docs.filter((p) => p.user.state != "BANNED" || "PRIVATE");
	}

	static async delete(PostID: string) {
		try {
			await prisma.comments.deleteMany({
				where: {
					postid: PostID,
				},
			});

			await prisma.plugins.deleteMany({
				where: {
					postid: PostID,
				},
			});

			await prisma.upvotes.deleteMany({
				where: {
					postid: PostID,
				},
			});

			await prisma.downvotes.deleteMany({
				where: {
					postid: PostID,
				},
			});

			await prisma.posts.delete({
				where: {
					postid: PostID,
				},
			});

			return true;
		} catch (err) {
			return err;
		}
	}

	static async upvote(PostID: string, UserID: string) {
		try {
            const user = await prisma.users.findUnique({
                where: {
                    userid: UserID,
                }
            });

			if (user.state != "VOTE_BANNED" || "BANNED") await prisma.upvotes.create({
				data: {
					postid: PostID,
					userid: UserID,
				},
			});
            else throw new Error("User cannot vote for posts. Reason: Punishment");

			return true;
		} catch (err) {
			return err;
		}
	}

	static async downvote(PostID: string, UserID: string) {
		try {
			const user = await prisma.users.findUnique({
                where: {
                    userid: UserID,
                }
            });

			if (user.state != "VOTE_BANNED" || "BANNED") await prisma.downvotes.create({
				data: {
					postid: PostID,
					userid: UserID,
				},
			});
            else throw new Error("User cannot vote for posts. Reason: Punishment");
            
			return true;
		} catch (err) {
			return err;
		}
	}

	static async comment(
		PostID: string,
		UserID: string,
		Caption: string,
		Image: string
	) {
		try {
			const user = await prisma.users.findUnique({
                where: {
                    userid: UserID,
                }
            });

			if (user.state != "BANNED") await prisma.comments.create({
				data: {
					postid: PostID,
					commentid: crypto.randomUUID().toString(),
					creatorid: UserID,
					caption: Caption,
					image: Image,
				},
			});
            else throw new Error("User cannot comment on posts. Reason: Punishment");

			return true;
		} catch (err) {
			return err;
		}
	}
}

// Developer Applications
class Applications {
	static async createApp(creator_id: string, name: string, logo: string) {
		try {
			const token: string = crypto
				.createHash("sha256")
				.update(
					`${crypto.randomUUID()}_${crypto.randomUUID()}`.replace(
						/-/g,
						""
					)
				)
				.digest("hex");

			await prisma.applications.create({
				data: {
					creatorid: creator_id,
					name: name,
					logo: logo,
					token: token,
					active: true,
					permissions: ["global.*"],
				},
			});

			return token;
		} catch (err) {
			return err;
		}
	}

	static async updateApp(token: string, data: any) {
		try {
			await prisma.applications.update({
				data: data,
				where: {
					token: token,
				},
			});

			return true;
		} catch (err) {
			return err;
		}
	}

	static async get(token: string) {
		const tokenData = await prisma.applications.findUnique({
			where: {
				token: token,
			},
			include: {
				owner: true,
			},
		});

		if (tokenData) return tokenData;
		else return null;
	}

	static async getAllApplications(creatorid: string) {
		try {
			const doc = await prisma.applications.findMany({
				where: {
					creatorid: creatorid,
				},
				include: {
					owner: true,
				},
			});

			return doc;
		} catch (error) {
			return error;
		}
	}

	static async delete(data: any) {
		try {
			await prisma.applications.delete({
				where: data,
			});

			return true;
		} catch (err) {
			return err;
		}
	}
}

// Partners
class Partners {
	static async get(data: any) {
		const partner = await prisma.partners.findUnique({
			where: data,
			include: {
				links: true,
			},
		});

		if (partner) return partner;
		else return null;
	}

	static async getAllPartners() {
		try {
			const doc = await prisma.partners.findMany({
				include: {
					links: true,
				},
			});

			return doc;
		} catch (error) {
			return error;
		}
	}
}

// Export the classes
export { prisma, Users, Posts, Applications, Partners };
