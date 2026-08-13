const $ = (selector) => document.querySelector(selector);
const fmt = new Intl.NumberFormat("tr-TR");
const today = new Date(); const start = new Date(); start.setDate(today.getDate() - 29);
$("#end").value = iso(today); $("#start").value = iso(start);

async function api(path) { const response = await fetch(path); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Request failed"); return body; }
function iso(date) { return date.toISOString().slice(0, 10); }
function money(value) { return value ? `${fmt.format(Number(value.amount))} ${value.currency}` : "—"; }
function percent(value) { return value === undefined ? "—" : `%${fmt.format(Number(value) * 100)}`; }

async function refresh() {
  notice(); $("#refresh").disabled = true;
  try {
    const [accounts, campaigns, report] = await Promise.all([
      api("/api/accounts"), api("/api/campaigns"), api(`/api/reports/campaigns?start=${$("#start").value}&end=${$("#end").value}`)
    ]);
    const account = accounts.data[0]; $("#account").textContent = account ? `${account.displayName || account.orgName || account.orgId} · ${account.currency || ""}` : "No accessible account found";
    $("#range").textContent = `${report.range.start} → ${report.range.end}`;
    drawReport(report.data); drawCampaigns(campaigns.data);
  } catch (error) { notice(error.message); } finally { $("#refresh").disabled = false; }
}

function drawReport(rows) {
  const totals = rows.reduce((sum, row) => { const t=row.total||{}; sum.impressions += Number(t.impressions||0); sum.taps += Number(t.taps||0); sum.installs += Number(t.installs||t.totalInstalls||0); sum.spend += Number(t.localSpend?.amount||0); sum.currency ||= t.localSpend?.currency; return sum; }, {impressions:0,taps:0,installs:0,spend:0,currency:""});
  $("#totals").replaceChildren(...[["Impressions",fmt.format(totals.impressions)],["Taps",fmt.format(totals.taps)],["Installs",fmt.format(totals.installs)],["Spend",`${fmt.format(totals.spend)} ${totals.currency}`]].map(([label,value]) => el("article",{className:"card"},el("span",{},label),el("strong",{},value))));
  $("#reports").replaceChildren(...rows.map(row => { const m=row.metadata||{},t=row.total||{}; return el("tr",{},cell(m.campaignName||`#${m.campaignId||"—"}`),cell(t.impressions),cell(t.taps),cell(t.installs??t.totalInstalls),cell(money(t.localSpend)),cell(money(t.avgCPT)),cell(money(t.tapInstallCPI)),cell(percent(t.ttr))); }));
}

function drawCampaigns(campaigns) {
  $("#campaigns").replaceChildren(...campaigns.map(campaign => { const details=el("div",{className:"details hidden"},"Not loaded"); const button=el("button",{className:"campaign-button"},el("strong",{},campaign.name),el("span",{},`${campaign.displayStatus||campaign.status||"—"} · ${campaign.countriesOrRegions?.join(", ")||""}`)); button.addEventListener("click",async()=>{ if(details.dataset.loaded){details.classList.toggle("hidden");return;} details.classList.remove("hidden"); details.textContent="Loading…"; try{const [groups,keywords]=await Promise.all([api(`/api/campaigns/${campaign.id}/adgroups`),api(`/api/campaigns/${campaign.id}/keywords`)]); details.replaceChildren(el("div",{className:"details-grid"},detailBox("Ad groups",groups.data,g=>[g.name,money(g.defaultBidAmount)]),detailBox("Keywords",keywords.data,k=>[`${k.text} · ${k.matchType||""}`,money(k.bidAmount)]))); details.dataset.loaded="true";}catch(error){details.textContent=error.message;}}); return el("div",{className:"campaign"},button,details); }));
}
function detailBox(title,items,map){return el("div",{className:"detail-box"},el("h3",{},title),...(items.length?items.map(item=>{const [a,b]=map(item);return el("div",{className:"detail-row"},el("span",{},a),el("span",{},b));}):[el("p",{},"No records")]));}
function cell(value){return el("td",{},value===undefined?"—":typeof value==="number"?fmt.format(value):String(value));}
function el(tag,props={},...children){const node=document.createElement(tag);Object.assign(node,props);node.append(...children.map(child=>child instanceof Node?child:document.createTextNode(String(child))));return node;}
function notice(message){$("#notice").textContent=message||"";$("#notice").classList.toggle("hidden",!message);}
$("#refresh").addEventListener("click",refresh); refresh();
