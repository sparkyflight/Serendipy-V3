import { Redis } from "ioredis";
import type { Redis as RedisClient, RedisOptions } from "ioredis";

type PublishCallback = (channel: string, message: string) => void;
type XReadMessage = { id: string; values: Record<string, string> };
type XReadResult = { stream: string; messages: XReadMessage[] };

/**
 * A Redis service wrapper supporting CRUD, JSON, pub/sub, wildcard channels,
 * key scanning, and Redis Streams with consumer groups.
 */
export class RedisService {
	private redis: RedisClient;
	private subscriber: RedisClient;
	private namespace: string;

	/**
	 * Creates a RedisService instance.
	 * @param options Redis connection options.
	 * @param namespace Optional string prefix for keys and channels.
	 */
	constructor(options?: RedisOptions, namespace = "") {
		this.redis = new Redis(options);
		this.subscriber = new Redis(options);
		this.namespace = namespace ? `${namespace}:` : "";
	}

	/**
	 * Sets a string value for a key, optionally with TTL in seconds.
	 * @param key Key name.
	 * @param value String value to set.
	 * @param ttlInSeconds Optional TTL in seconds.
	 * @returns Promise resolving to "OK".
	 */
	async set(
		key: string,
		value: string,
		ttlInSeconds?: number
	): Promise<"OK"> {
		const fullKey = this.namespace + key;
		if (ttlInSeconds) {
			return this.redis.set(fullKey, value, "EX", ttlInSeconds);
		}
		return this.redis.set(fullKey, value);
	}

	/**
	 * Sets a JSON-serializable value under a key, optionally with TTL.
	 * @param key Key name.
	 * @param value JSON-serializable value.
	 * @param ttlInSeconds Optional TTL in seconds.
	 * @returns Promise resolving to "OK".
	 */
	async setJson<T>(
		key: string,
		value: T,
		ttlInSeconds?: number
	): Promise<"OK"> {
		return this.set(key, JSON.stringify(value), ttlInSeconds);
	}

	/**
	 * Gets a string value by key.
	 * @param key Key name.
	 * @returns Promise resolving to string value or null if not found.
	 */
	async get(key: string): Promise<string | null> {
		return this.redis.get(this.namespace + key);
	}

	/**
	 * Gets and parses a JSON value by key.
	 * @param key Key name.
	 * @returns Promise resolving to parsed JSON value or null if not found.
	 */
	async getJson<T>(key: string): Promise<T | null> {
		const raw = await this.get(key);
		return raw ? (JSON.parse(raw) as T) : null;
	}

	/**
	 * Deletes a key.
	 * @param key Key name.
	 * @returns Promise resolving to the number of keys deleted (0 or 1).
	 */
	async del(key: string): Promise<number> {
		return this.redis.del(this.namespace + key);
	}

	/**
	 * Checks if a key exists.
	 * @param key Key name.
	 * @returns Promise resolving to true if exists, false otherwise.
	 */
	async exists(key: string): Promise<boolean> {
		const result = await this.redis.exists(this.namespace + key);
		return result === 1;
	}

	/**
	 * Publishes a message to a channel.
	 * @param channel Channel name.
	 * @param message Message string.
	 * @returns Promise resolving to number of clients that received the message.
	 */
	async publish(channel: string, message: string): Promise<number> {
		return this.redis.publish(this.namespace + channel, message);
	}

	/**
	 * Publishes a JSON message to a channel.
	 * @param channel Channel name.
	 * @param data JSON-serializable data.
	 * @returns Promise resolving to number of clients that received the message.
	 */
	async publishJson<T>(channel: string, data: T): Promise<number> {
		return this.publish(channel, JSON.stringify(data));
	}

	/**
	 * Subscribes to a channel with a callback for received messages.
	 * @param channel Channel name.
	 * @param callback Callback invoked with channel and message.
	 */
	async subscribe(channel: string, callback: PublishCallback): Promise<void> {
		const fullChannel = this.namespace + channel;
		await this.subscriber.subscribe(fullChannel);
		this.subscriber.on("message", (ch, msg) => {
			if (ch === fullChannel) {
				callback(ch.replace(this.namespace, ""), msg);
			}
		});
	}

	/**
	 * Subscribes to a channel expecting JSON messages.
	 * @param channel Channel name.
	 * @param callback Callback invoked with channel and parsed JSON message.
	 */
	async subscribeJson<T>(
		channel: string,
		callback: (channel: string, message: T) => void
	): Promise<void> {
		await this.subscribe(channel, (ch, msg) => {
			try {
				callback(ch, JSON.parse(msg));
			} catch {
				console.warn(`Invalid JSON received on ${ch}:`, msg);
			}
		});
	}

	/**
	 * Subscribes to channels matching a pattern with wildcard support.
	 * @param pattern Pattern to subscribe to.
	 * @param callback Callback invoked with channel and message.
	 */
	async psubscribe(
		pattern: string,
		callback: PublishCallback
	): Promise<void> {
		const namespacedPattern = this.namespace + pattern;
		await this.subscriber.psubscribe(namespacedPattern);
		this.subscriber.on("pmessage", (pattern, ch, msg) => {
			const channel = ch.replace(this.namespace, "");
			callback(channel, msg);
		});
	}

	/**
	 * Unsubscribes from a pattern subscription.
	 * @param pattern Pattern string.
	 */
	async punsubscribe(pattern: string): Promise<void> {
		await this.subscriber.punsubscribe(this.namespace + pattern);
	}

	/**
	 * Scans keys matching a pattern.
	 * @param pattern Pattern string, defaults to "*".
	 * @param count Number of keys to scan per iteration.
	 * @returns Promise resolving to an array of matching keys (namespace stripped).
	 */
	async scanKeys(pattern = "*", count = 100): Promise<string[]> {
		const keys: string[] = [];
		let cursor = "0";
		const fullPattern = this.namespace + pattern;

		do {
			const [nextCursor, found] = await this.redis.scan(
				cursor,
				"MATCH",
				fullPattern,
				"COUNT",
				count
			);
			cursor = nextCursor;
			keys.push(...found.map((key) => key.replace(this.namespace, "")));
		} while (cursor !== "0");

		return keys;
	}

	/**
	 * Gracefully closes Redis connections.
	 */
	async close(): Promise<void> {
		await Promise.all([this.redis.quit(), this.subscriber.quit()]);
	}

	/**
	 * Adds an entry to a Redis stream.
	 * @param stream Stream key.
	 * @param values Key-value pairs to add.
	 * @param id Entry ID or "*" for auto.
	 * @returns Promise resolving to the ID of the added entry.
	 */
	async xadd(
		stream: string,
		values: Record<string, string>,
		id = "*"
	): Promise<string> {
		const fullStream = this.namespace + stream;
		const args: string[] = [];
		for (const [key, value] of Object.entries(values)) {
			args.push(key, value);
		}
		return this.redis.xadd(fullStream, id, ...args);
	}

	/**
	 * Reads entries from a Redis stream.
	 * @param stream Stream key.
	 * @param lastId ID to read after, defaults to "$" (new entries).
	 * @param blockMs Optional milliseconds to block waiting for entries.
	 * @returns Promise resolving to array of streams and messages.
	 */
	async xread(
		stream: string,
		lastId = "$",
		blockMs?: number
	): Promise<XReadResult[]> {
		const fullStream = this.namespace + stream;
		const options: any = { streams: [fullStream], keys: [lastId] };
		if (blockMs) options.block = blockMs;

		const res = await this.redis.xread(options);
		if (!res) return [];

		return res.map(([streamName, entries]: [string, any[]]) => ({
			stream: streamName.replace(this.namespace, ""),
			messages: entries.map(([id, fields]: [string, string[]]) => {
				const obj: Record<string, string> = {};
				for (let i = 0; i < fields.length; i += 2) {
					obj[fields[i]] = fields[i + 1];
				}
				return { id, values: obj };
			}),
		}));
	}

	/**
	 * Creates a consumer group for a stream, optionally from a given ID.
	 * @param stream Stream key.
	 * @param group Group name.
	 * @param from ID to start from, default "0".
	 * @returns Promise resolving to "OK" or "OK" if group already exists.
	 */
	async xgroupCreate(
		stream: string,
		group: string,
		from = "0"
	): Promise<"OK" | string> {
		const fullStream = this.namespace + stream;
		try {
			return (await this.redis.xgroup(
				"CREATE",
				fullStream,
				group,
				from,
				"MKSTREAM"
			)) as any;
		} catch (e: any) {
			if (e?.message?.includes("BUSYGROUP")) return "OK"; // Already exists
			throw e;
		}
	}

	/**
	 * Reads messages from a stream consumer group.
	 * @param stream Stream key.
	 * @param group Group name.
	 * @param consumer Consumer name.
	 * @param count Max messages to read.
	 * @param blockMs Milliseconds to block waiting, 0 for no block.
	 * @returns Promise resolving to array of messages with IDs and values.
	 */
	async xreadGroup(
		stream: string,
		group: string,
		consumer: string,
		count = 1,
		blockMs = 0
	): Promise<{ id: string; values: Record<string, string> }[]> {
		const fullStream = this.namespace + stream;
		const res = await this.redis.xreadgroup(
			"GROUP",
			group,
			consumer,
			"STREAMS",
			this.namespace + stream,
			">",
			...(blockMs > 0 ? ["BLOCK", blockMs] : []),
			...(count > 0 ? ["COUNT", count] : [])
		);

		if (!res || res.length === 0) return [];

		const entries = res[0][1];
		return entries.map(([id, fields]) => {
			const parsed: Record<string, string> = {};
			for (let i = 0; i < fields.length; i += 2) {
				parsed[fields[i]] = fields[i + 1];
			}
			return { id, values: parsed };
		});
	}

	/**
	 * Acknowledges a message in a consumer group.
	 * @param stream Stream key.
	 * @param group Group name.
	 * @param id Message ID.
	 * @returns Promise resolving to number of messages acknowledged.
	 */
	async xack(stream: string, group: string, id: string): Promise<number> {
		const fullStream = this.namespace + stream;
		return this.redis.xack(fullStream, group, id);
	}
}
