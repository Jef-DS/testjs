import { promises} from "fs";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { createHash } from "crypto";
import sessieLijst from './public/data/sessies.json';
import { UrlWithParsedQuery, parse } from "url";

const FILES_DIR = 'files/';
const root = __dirname + '\\public';
console.log(root)
const server = createServer(async(req, res) => {
    console.log(req.url);
    try{
        if (req.method === 'GET'){
            if (req.url?.startsWith('/data')){
                res.setHeader('Content-Type','text/html');
                //res.setHeader('Cache-Control', 'max-age=3600')
                const url = parse(req.url, true);
                if (req.url?.startsWith('/data/sessies')){
                    handleSessies(url, res);
                } else if (req.url?.startsWith('/data/inschrijving')){
                    handleInschrijvingsForm(url, res);
                }
            }else{
               await handleGet(req, res);
            }
        } else if (req.method === 'POST'){
            const body = await getBody(req) as Map<string, string>;
            bewaarPersoon(body);
            res.statusCode=201;
            res.setHeader("Content-Type", "text/html");
            res.end('<p>Je bent ingeschreven voor deze sessie</p>');
        }
    }catch(err){
        console.log(err)
        res.statusCode=404;
        res.end()
    }
})

const getBody = async (req: IncomingMessage) => {
    return new Promise(res => {
        let data = '';
        req.on('data', d => {
            data += d;
        }).on ('end', () => {
            const elements = decodeURIComponent(data).split("&");
            const resultaat = elements.map(el => {
                return el.split('=');
            }).reduce((acc, curr:Array<string>) => acc.set(curr[0], curr[1]), new Map<string, string>());
            res(resultaat);
        })
    })

}
function handleInschrijvingsForm(url:UrlWithParsedQuery, res:ServerResponse<IncomingMessage> & {req: IncomingMessage}){
    const cursusid = parseInt(url.query['cursus'] as string);
    const sessieid = parseInt(url.query['sessie'] as string);
    const html = getInschrijvingsForm(cursusid, sessieid);
    res.write(html);
    res.statusCode = 200;
    res.end();
}
function handleSessies(url:UrlWithParsedQuery, res:ServerResponse<IncomingMessage> & {req: IncomingMessage}){
    const cursusid = parseInt(url.query['cursus'] as string);
    const html = getSessies(cursusid);
    res.write(html);
    res.statusCode=200;
    res.end();
}
async function handleGet(req:IncomingMessage, res:ServerResponse<IncomingMessage> &{req: IncomingMessage}){
    res.setHeader('Vary', 'Etag, Content-Encoding');
    const bestandsnaam = req.url?.endsWith('/')?req.url+'index.html':req.url;
    if (bestandsnaam?.endsWith('html')){
        res.setHeader('Content-Type','text/html');
    }
    if (req.url?.startsWith('/scripts')){
        res.setHeader('Cache-Control', 'max-age=3600')
    }
    const data = await  promises.readFile(root+bestandsnaam)
    const etag = getSHA1(data.toString());
    res.setHeader('ETag', etag);
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch === etag){
        res.statusCode = 304;
    }else {
        res.write(data)
        res.statusCode = 200
    }
    res.end();
}
function getSHA1(tekst:string):string{
    const shasum = createHash('sha1');
    shasum.update(tekst);
    return shasum.digest('hex').toString();
}
const formatter = new Intl.DateTimeFormat('nl-BE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
function getSessies(cursusid:number): string{
    const binnenEenWeek = new Date(Date.now() + 7*24*60*60*1000);
    const sessies = sessieLijst.filter(s => { return s.cursusid === cursusid && binnenEenWeek < new Date(s.sessies[0].datum) });
    if (sessies.length === 0) return "";
    let html = '<ol>'
    sessies.forEach(s => {
        const header = `<li><table class="sessie"><thead><tr><th>Datum</th><th>Uren</th>`+
                       `<th><button class="inschrijving" name="inschrijvingsbutton" hx-params="none" hx-get="/data/inschrijving?cursus=${cursusid}&sessie=${s.sessieid}" hx-target="#sessie-${s.sessieid}">Inschrijven voor deze sessie</button></th></thead><tbody>`
        const rijen = s.sessies.map(item => { 
            return `<tr><td class="sessie__datum">${formatter.format(new Date(item.datum))}</td>`+
                   `<td class="sessie__uren">${item.van}u - ${item.tot}u</td></tr>`
        })
        const footer = `</tbody></table><div id="sessie-${s.sessieid}"></div></li>`
        html += header + rijen.join(' ') + footer;
    })
    html += '</ol>'
    return html;
}
const voorWie = '<p>Ik schrijf in voor:</p><label><input checked type="radio" name="voorwie" value="mezelf"/>mezelf</label>' +
                '<label><input type="radio" name="voorwie" value="collegas"/>een of meerdere collega\'s</label>'
const basisform = '<div class="formelement"><label for="voornaam">Voornaam:</label><input type="text" required id="voornaam" name="voornaam" size="50"/></div>' +
                  '<div class="formelement"><label for="achternaam">Achternaam:</label><input type="text" required id="achternaam" name="achternaam" size="50"/></div>' +
                  '<div class="formelement"><label for="email">Emailadres:</label><input type="email" required id="email" name="email" size="50"/></div>' +
                  '<div class="formelement"><button type="submit" class="inschrijving">Inschrijven</button><button type="reset" class="inschrijving">Annuleren</button></div>'
function getInschrijvingsForm(cursusid:number, sessieid:number){
    const sessie = sessieLijst.filter(s => s.cursusid === cursusid && s.sessieid == sessieid)[0]
    let html = `<form id="inschrijvingsform" hx-post="/jef/inschrijving" hx-trigger="submit" hx-target="#sessie-${sessieid}"` 
                + voorWie 
                + `<input type="hidden" name="cursusid" value="${cursusid}"/>`
                + `<input type="hidden" name="sessieid" value="${sessieid}"/>`
                + basisform;
    html += '</form>'
    return html;
}

async function bewaarPersoon(data: Map<string, string>) {
    const datum = new Date().toISOString()
    const bestandsnaam = FILES_DIR + datum.substring(0,10)+"persoon.csv"
    const regel = `${datum};${data.get('voornaam')};${data.get('achternaam')};${data.get('email')};${data.get('cursusid')};${data.get('sessieid')}\n`
    await promises.appendFile(bestandsnaam, regel);
}
async function bewaarBedrijf(data: Body) {
    const datum = new Date().toISOString();
    const bestandsnaam = FILES_DIR + datum.substring(0,10)+"bedrijf.csv"
    if (!data.personen) throw new HttpError("Onbekende fout", 500);
    for (let i = 0; i < data.personen.length; i++) {
        const regel = `${datum};${data.voornaam};${data.achternaam};${data.email};${data.cursusid};${data.sessieid};` +
            `${data.bedrijf};${data.btw};${data.personen[i].voornaam};${data.personen[i].achternaam};${data.personen[i].email}\n`
        await promises.appendFile(bestandsnaam, regel);
    }
}

type Body = {
    voornaam: string,
    achternaam: string,
    email: string,
    cursusid: number,
    sessieid: number,
    bedrijf?: string,
    btw?:string,
    personen?: Array<{voornaam: string, achternaam: string, email:string}>
}

class HttpError extends Error{
    constructor(message:string, public code:number){
        super(message)
    }
}
server.listen(8080, () => console.log('listening'));