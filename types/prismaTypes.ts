// AUTO GENERATED FILE BY @kalissaac/prisma-typegen
// DO NOT EDIT


export enum State {
    ACTIVE = 'ACTIVE',
    BANNED = 'BANNED',
    VOTE_BANNED = 'VOTE_BANNED',
    FOLLOW_BANNED = 'FOLLOW_BANNED',
    PRIVATE = 'PRIVATE',
}

export enum platform {
    DISCORD = 'DISCORD',
    TWITTER = 'TWITTER',
    INSTAGRAM = 'INSTAGRAM',
    TIKTOK = 'TIKTOK',
    YOUTUBE = 'YOUTUBE',
    GITHUB = 'GITHUB',
    WEBSITE = 'WEBSITE',
}

export enum badge {
    STAFF = 'STAFF',
    VERIFIED = 'VERIFIED',
}


export interface partnerLinks {
    id: string,
    partnerName: string,
    partner: partners,
    name: string,
    emoji: string,
    link: string,
}

export interface partners {
    id: string,
    name: string,
    logo: string,
    category: string,
    owner: string,
    ownerImage: string,
    ownerLink?: string,
    description: string,
    long_description: string,
    links: partnerLinks[],
}

export interface authorized_apps {
    id: string,
    user_id: string,
    authorized_user: users,
    application_id: string,
    application: applications,
    scopes: string[],
    token: string,
    expires_at?: Date,
    revoked_at?: Date,
}

export interface applications {
    creatorid: string,
    owner: users,
    name: string,
    logo: string,
    client_id?: string,
    client_secret?: string,
    scopes: string[],
    token: string,
    active: boolean,
    permissions: string[],
    authorized_apps: authorized_apps[],
}

export interface plugins {
    id: number,
    postid: string,
    post: posts,
    type: string,
    href?: string,
    jsonData?: any,
}

export interface comments {
    creatorid: string,
    user: users,
    caption: string,
    image?: string,
    post: posts,
    postid: string,
    commentid: string,
}

export interface upvotes {
    id: string,
    userid: string,
    postid: string,
    post: posts,
}

export interface downvotes {
    id: string,
    userid: string,
    postid: string,
    post: posts,
}

export interface following {
    id: string,
    userid: string,
    user: users,
    targetid: string,
    target: users,
}

export interface posts {
    userid: string,
    user: users,
    caption: string,
    image?: string,
    plugins: plugins[],
    type: number,
    postid: string,
    upvotes: upvotes[],
    downvotes: downvotes[],
    comments: comments[],
    createdat: Date,
}

export interface social {
    id: string,
    userid: string,
    user: users,
    platform: platform,
    link: string,
}

export interface users {
    name?: string,
    usertag: string,
    userid: string,
    discord_id?: string,
    bio: string,
    avatar: string,
    banner: string,
    socials: social[],
    followers: following[],
    following: following[],
    badges: badge[],
    specialInterests: string[],
    pronouns?: string,
    birthDay?: Date,
    state: State,
    staff_perms: string[],
    applications: applications[],
    posts: posts[],
    comments: comments[],
    authorized_apps: authorized_apps[],
}
