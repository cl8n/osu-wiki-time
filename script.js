const base64UrlDigits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const base64UrlValues = {};

for (let i = 0; i < 64; i++) {
	base64UrlValues[base64UrlDigits[i]] = i;
}

/**
 * @param {string} data
 * @returns {Uint8Array | undefined}
 */
function decodeBase64Url(data) {
	if (data.length % 4 === 1) {
		return;
	}

	for (const character of data) {
		if (base64UrlValues[character] == null) {
			return;
		}
	}

	const decoded = new Uint8Array(Math.floor(data.length / 4 * 3));
	let dataIndex = 0;
	let decodedIndex = 0;

	for (; dataIndex <= data.length - 4; dataIndex += 4, decodedIndex += 3) {
		const values = [0, 1, 2, 3].map((i) => base64UrlValues[data[dataIndex + i]]);
		decoded[decodedIndex] = (values[0] << 2) | (values[1] >>> 4);
		decoded[decodedIndex + 1] = ((values[1] & 0x0F) << 4) | (values[2] >>> 2);
		decoded[decodedIndex + 2] = ((values[2] & 0x03) << 6) | values[3];
	}

	switch (data.length - dataIndex) {
		case 2:
			const values2 = [0, 1].map((i) => base64UrlValues[data[dataIndex + i]]);
			decoded[decodedIndex] = (values2[0] << 2) | (values2[1] >>> 4);
			break;
		case 3:
			const values3 = [0, 1, 2].map((i) => base64UrlValues[data[dataIndex + i]]);
			decoded[decodedIndex] = (values3[0] << 2) | (values3[1] >>> 4);
			decoded[decodedIndex + 1] = ((values3[1] & 0x0F) << 4) | (values3[2] >>> 2);
			break;
	}

	return decoded;
}

/**
 * @param {Uint8Array} data
 * @returns {string}
 */
function encodeBase64Url(data) {
	let encoded = '';
	let i = 0;

	for (; i <= data.length - 3; i += 3) {
		encoded +=
			base64UrlDigits[data[i] >>> 2] +
			base64UrlDigits[((data[i] & 0x03) << 4) | (data[i + 1] >>> 4)] +
			base64UrlDigits[((data[i + 1] & 0x0F) << 2) | (data[i + 2] >>> 6)] +
			base64UrlDigits[data[i + 2] & 0x3F];
	}

	switch (data.length - i) {
		case 1:
			encoded +=
				base64UrlDigits[data[i] >>> 2] +
				base64UrlDigits[(data[i] & 0x03) << 4];
			break;
		case 2:
			encoded +=
				base64UrlDigits[data[i] >>> 2] +
				base64UrlDigits[((data[i] & 0x03) << 4) | (data[i + 1] >>> 4)] +
				base64UrlDigits[(data[i + 1] & 0x0F) << 2];
			break;
	}

	return encoded;
}

/**
 * @param {Uint8Array} uint8Array
 * @returns {[string, number]}
 */
function uint8ToString(uint8Array) {
	const endIndex = uint8Array.indexOf(0);

	if (endIndex == null) {
		throw 'Expected terminating zero, none found';
	}

	return [String.fromCharCode(...uint8Array.subarray(0, endIndex)), endIndex + 1];
}

/**
 * @param {string} string
 * @param {Uint8Array} uint8Array
 * @returns {number}
 */
function stringToUint8(string, uint8Array) {
	let index = 0;

	for (; index < string.length; index++) {
		uint8Array[index] = string.charCodeAt(index);
	}

	uint8Array[index] = 0;
	return index + 1;
}

/**
 * @param {bigint} int
 * @param {number} bits
 * @returns {bigint}
 */
function clampBigIntToBits(int, bits) {
	bits = BigInt(bits - 1);
	const lowerBound = -(2n ** bits);
	const upperBound = 2n ** bits - 1n;

	if (int < lowerBound) {
		return lowerBound;
	}

	if (int > upperBound) {
		return upperBound;
	}

	return int;
}

/**
 * @typedef {Object} State
 * @property {Date} date
 * @property {StateEntry} entries
 */
/**
 * @typedef {Object} StateEntry
 * @property {string} flag
 * @property {string} timeZone
 */

/**
 * @param {string | undefined} string
 * @returns {State}
 */
function decodeState(string) {
	if (string[0] !== base64UrlDigits[0]) {
		throw new Error();
	}

	const bytes = decodeBase64Url(string.slice(1, 8) + 'AAAA');

	if (bytes == null) {
		throw new Error();
	}

	return {
		date: new Date(Number(BigInt.asIntN(40, new DataView(bytes.buffer).getBigUint64(0, true)) * 1000n)),
		entries: string.slice(8)
			? string.slice(8).split('~').map((entryString) => ({
				flag: entryString.slice(0, 2),
				timeZone: entryString.slice(2).replace(/\./g, '\/'),
			}))
			: [],
	};
}

/**
 * @param {State} state
 * @returns {string}
 */
function encodeState(state) {
	const buffer = new ArrayBuffer(8);
	const view = new DataView(buffer);
	view.setBigInt64(0, clampBigIntToBits(BigInt(Math.floor(state.date.getTime() / 1000)), 40), true);
	const timeZoneRegex = /^[A-Za-z0-9/+_-]+$/;

	return (
		base64UrlDigits[0] +
		encodeBase64Url(new Uint8Array(buffer, 0, 5)) +
		state.entries.map((entry) => {
			if (entry.flag.length !== 2 || !timeZoneRegex.test(entry.timeZone)) {
				throw new Error();
			}

			return entry.flag + entry.timeZone.replace(/\//g, '.');
		}).join('~')
	);
}

/**
 * @param {Date} date
 * @returns {HTMLElement}
 */
function createRelativeTimeEl(date) {
	const el = document.createElement('time');
	el.className = 'relative-time';
	el.dateTime = date.toISOString();
	updateRelativeTimeEl(el);
	setInterval(() => updateRelativeTimeEl(el), 60000);
	return el;
}

/**
 * @param {HTMLTimeElement} el
 * @returns {void}
 */
function updateRelativeTimeEl(el) {
	el.innerText = dayjs(el.dateTime).fromNow();
}

/**
 * @param {Date} date
 * @param {StateEntry | undefined} entry
 * @returns {HTMLElement}
 */
function createEntryEl(date, entry) {
	const el = document.createElement('div');
	el.className = 'entry';

	if (entry == null) {
		const { locale, timeZone } = new Intl.DateTimeFormat().resolvedOptions();
		entry = {
			flag: new Intl.Locale(locale).region || 'XX',
			timeZone,
		};
		el.className += ' entry-local';
	}

	const isoTimeString = date.toISOString();
	const dateFormat = new Intl.DateTimeFormat(undefined, {
		day: 'numeric',
		month: 'short',
		weekday: 'short',
		year: 'numeric',
		timeZone: entry.timeZone,
	});
	const timeFormat = new Intl.DateTimeFormat(undefined, {
		timeStyle: 'short',
		timeZone: entry.timeZone,
	});
	const timeZoneLongFormat = new Intl.DateTimeFormat(undefined, {
		timeZone: entry.timeZone,
		timeZoneName: 'long',
	});
	const timeZoneShortFormat = new Intl.DateTimeFormat(undefined, {
		timeZone: entry.timeZone,
		timeZoneName: 'short',
	});
	const timeZoneOffsetFormat = new Intl.DateTimeFormat(undefined, {
		timeZone: entry.timeZone,
		timeZoneName: 'longOffset',
	});
	const timeZoneLong = timeZoneLongFormat.formatToParts(date).find((part) => part.type === 'timeZoneName').value ?? '';
	const timeZoneShort = timeZoneShortFormat.formatToParts(date).find((part) => part.type === 'timeZoneName').value?.replace(/^GMT/, 'UTC') ?? '';
	const timeZoneOffset = timeZoneOffsetFormat.formatToParts(date).find((part) => part.type === 'timeZoneName').value?.replace(/^GMT/, 'UTC') ?? '';

	const flagContainerEl = document.createElement('div');
	flagContainerEl.className = 'flag';
	const flagEl = document.createElement('img');
	flagEl.src = `https://osu.ppy.sh/images/flags/${entry.flag}.png`;
	flagContainerEl.appendChild(flagEl);
	el.appendChild(flagContainerEl);

	const timeZoneEl = document.createElement('div');
	timeZoneEl.className = 'timezone';
	const timeZoneNameEl = document.createElement('div');
	timeZoneNameEl.innerText = timeZoneLong;
	const timeZoneInfoEl = document.createElement('div');
	timeZoneInfoEl.className = 'timezone-extra';
	timeZoneInfoEl.innerText = timeZoneOffset && timeZoneOffset !== 'UTC' && timeZoneShort && !timeZoneShort.startsWith('UTC')
		? `${timeZoneOffset} — ${timeZoneShort}`
		: timeZoneOffset;
	timeZoneEl.append(timeZoneNameEl, timeZoneInfoEl);
	el.appendChild(timeZoneEl);

	const dateEl = document.createElement('time');
	dateEl.className = 'date';
	dateEl.dateTime = isoTimeString;
	dateEl.innerText = dateFormat.format(date);
	el.appendChild(dateEl);

	const timeEl = document.createElement('time');
	timeEl.className = 'time';
	timeEl.dateTime = isoTimeString;
	timeEl.innerText = timeFormat.format(date);
	el.appendChild(timeEl);

	return el;
}

dayjs.extend(window.dayjs_plugin_relativeTime);

document.addEventListener('DOMContentLoaded', () => {
	try {
		const stateString = document.location.pathname.endsWith('.html')
			? document.location.hash.slice(1)
			: document.location.pathname.split('/').pop();
		const state = decodeState(stateString);
		const els = [
			createRelativeTimeEl(state.date),
			document.createElement('hr'),
			createEntryEl(state.date),
			document.createElement('hr'),
			createEntryEl(state.date, {
				flag: 'XX',
				timeZone: 'Etc/UTC',
			}),
		];

		const mainRuleEl = document.createElement('hr');
		mainRuleEl.className = 'main-rule';
		els.push(mainRuleEl);

		for (const entry of state.entries) {
			els.push(
				createEntryEl(state.date, entry),
				document.createElement('hr'),
			);
		}

		document.body.append(...els.slice(0, -1));
	} catch (e) {
		const errorEl = document.createElement('div');
		errorEl.className = 'error';
		errorEl.innerText = 'Error loading the requested page.';
		document.body.appendChild(errorEl);

		throw e;
	}
});
