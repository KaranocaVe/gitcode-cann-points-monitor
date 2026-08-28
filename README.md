# GitCode CANN Points Monitor

A Tampermonkey userscript that watches the **CANN Exclusive Points** value on GitCode’s [CANN points page](https://gitcode.com/setting/points?type=shop&tid=cann). It stores the last value locally and shows a native browser notification when the value changes.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the [userscript](https://raw.githubusercontent.com/KaranocaVe/gitcode-cann-points-monitor/main/gitcode-cann-points-monitor.user.js) and confirm installation.
3. Visit the [CANN points page](https://gitcode.com/setting/points?type=shop&tid=cann) while signed in to GitCode.
4. Allow browser notifications when Tampermonkey or the browser asks.

The first successful observation only records a baseline. Later successful checks notify on any increase or decrease.

## Check schedule

The default interval is 30 minutes. The script runs only on the CANN points page and checks at most once per interval, so repeated page visits do not repeatedly request or inspect the value. It does not run while the browser or target page is closed.

Use Tampermonkey’s menu to:

- **Check CANN points now** — bypass the interval once.
- **Set check interval** — choose an interval of one minute or more.

## Privacy and behavior

- Reads the rendered CANN points value from the signed-in page; it does not submit forms, redeem items, or use credentials/API tokens.
- Stores only the latest numeric point total, successful-check time, and chosen interval in Tampermonkey storage.
- If GitCode’s page has not finished rendering within 15 seconds, the failed attempt does not advance the schedule.

## Development check

```sh
node --check gitcode-cann-points-monitor.user.js
```

## License

[MIT](LICENSE)
