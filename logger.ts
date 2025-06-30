import chalk from "chalk";

// Toggle debug logging globally
const DEBUG_ENABLED = true;

// Timestamp generator
const timestamp = () => chalk.gray(`[${new Date().toISOString()}]`);

// Pad log levels for clean formatting
const label = (type: string, color: (text: string) => string) =>
	chalk.bold(color(type.padEnd(7)));

// Core logger function
const log = (
	type: "INFO" | "DEBUG" | "ERROR" | "SUCCESS",
	name: string,
	message: string,
	data?: Record<string, any>
) => {
	let colorFunc;
	switch (type) {
		case "INFO":
			colorFunc = chalk.blue;
			break;
		case "DEBUG":
			colorFunc = chalk.cyan;
			break;
		case "ERROR":
			colorFunc = chalk.red;
			break;
		case "SUCCESS":
			colorFunc = chalk.green;
			break;
	}

	const formatted = `${timestamp()} ${label(
		type,
		colorFunc
	)} [${chalk.magenta(name)}] ${chalk.white("=>")} ${message}`;
	console.log(formatted);

	if (data) {
		console.dir(data, { depth: null, colors: true });
	}
};

// Public log methods
const info = (name: string, message: string, data?: Record<string, any>) =>
	log("INFO", name, message, data);

const debug = (name: string, message: string, data?: Record<string, any>) => {
	if (DEBUG_ENABLED) log("DEBUG", name, message, data);
};

const error = (name: string, message: string, data?: Record<string, any>) =>
	log("ERROR", name, message, data);

const success = (name: string, message: string, data?: Record<string, any>) =>
	log("SUCCESS", name, message, data);

// Export
export { info, debug, error, success };
