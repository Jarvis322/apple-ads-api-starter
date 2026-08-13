const $ = (selector) => document.querySelector(selector);
const fmt = new Intl.NumberFormat(navigator.language || "en-US");
const today = new Date();
const initialStart = new Date();
initialStart.setDate(today.getDate() - 29);
$("#end").value = iso(today);
$("#start").value = iso(initialStart);

async function api(path) {
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function rangeQuery() {
  return `start=${encodeURIComponent($("#start").value)}&end=${encodeURIComponent($("#end").value)}`;
}

function money(value) {
  return value ? `${fmt.format(Number(value.amount))} ${value.currency}` : "—";
}

function percent(value) {
  return value === undefined ? "—" : `${fmt.format(Number(value) * 100)}%`;
}

async function refresh() {
  notice();
  $("#refresh").disabled = true;
  try {
    const [accounts, campaigns, report] = await Promise.all([
      api("/api/accounts"),
      api("/api/campaigns"),
      api(`/api/reports/campaigns?${rangeQuery()}`)
    ]);
    const account = accounts.data[0];
    $("#account").textContent = account
      ? `${account.displayName || account.orgName || account.orgId} · ${account.currency || ""}`
      : "No accessible account found";
    $("#range").textContent = `${report.range.start} → ${report.range.end}`;
    drawReport(report.data);
    drawCampaigns(campaigns.data);
  } catch (error) {
    notice(error.message);
  } finally {
    $("#refresh").disabled = false;
  }
}

function drawReport(rows) {
  const totals = rows.reduce(
    (sum, row) => {
      const total = row.total || {};
      sum.impressions += Number(total.impressions || 0);
      sum.taps += Number(total.taps || 0);
      sum.installs += Number(total.installs || total.totalInstalls || 0);
      sum.spend += Number(total.localSpend?.amount || 0);
      sum.currency ||= total.localSpend?.currency;
      return sum;
    },
    { impressions: 0, taps: 0, installs: 0, spend: 0, currency: "" }
  );
  $("#totals").replaceChildren(
    ...[
      ["Impressions", fmt.format(totals.impressions)],
      ["Taps", fmt.format(totals.taps)],
      ["Installs", fmt.format(totals.installs)],
      ["Spend", `${fmt.format(totals.spend)} ${totals.currency}`]
    ].map(([label, value]) =>
      el("article", { className: "card" }, el("span", {}, label), el("strong", {}, value))
    )
  );
  $("#reports").replaceChildren(
    ...rows.map((row) => {
      const metadata = row.metadata || {};
      const total = row.total || {};
      return el(
        "tr",
        {},
        cell(metadata.campaignName || `#${metadata.campaignId || "—"}`),
        cell(total.impressions),
        cell(total.taps),
        cell(total.installs ?? total.totalInstalls),
        cell(money(total.localSpend)),
        cell(money(total.avgCPT)),
        cell(money(total.tapInstallCPI)),
        cell(percent(total.ttr))
      );
    })
  );
}

function drawCampaigns(campaigns) {
  $("#campaigns").replaceChildren(
    ...campaigns.map((campaign) => {
      const details = el("div", { className: "details hidden" }, "Not loaded");
      const button = el(
        "button",
        { className: "campaign-button" },
        el("strong", {}, campaign.name),
        el(
          "span",
          {},
          `${campaign.displayStatus || campaign.status || "—"} · ${campaign.countriesOrRegions?.join(", ") || ""}`
        )
      );
      button.addEventListener("click", async () => {
        if (details.dataset.loaded) {
          details.classList.toggle("hidden");
          return;
        }
        details.classList.remove("hidden");
        details.textContent = "Loading…";
        try {
          const reportQuery = rangeQuery();
          const [groups, keywords, groupReport, keywordReport, searchTerms] = await Promise.all([
            api(`/api/campaigns/${campaign.id}/adgroups`),
            api(`/api/campaigns/${campaign.id}/keywords`),
            api(`/api/campaigns/${campaign.id}/reports/adgroups?${reportQuery}`),
            api(`/api/campaigns/${campaign.id}/reports/keywords?${reportQuery}`),
            api(`/api/campaigns/${campaign.id}/reports/searchterms?${reportQuery}`)
          ]);
          details.replaceChildren(
            el(
              "div",
              { className: "details-grid" },
              detailBox("Ad groups", groups.data, (group) => [group.name, money(group.defaultBidAmount)]),
              detailBox("Targeting keywords", keywords.data, (keyword) => [
                `${keyword.text} · ${keyword.matchType || ""}`,
                money(keyword.bidAmount)
              ]),
              detailBox("Keyword performance", keywordReport.data, (row) => [
                `${row.metadata?.keyword || `#${row.metadata?.keywordId || "—"}`} · ${row.metadata?.matchType || ""}`,
                performance(row.total)
              ]),
              detailBox("Search terms", searchTerms.data, (row) => [
                row.metadata?.searchTermText || row.metadata?.searchTerm || "Unknown term",
                performance(row.total)
              ]),
              detailBox("Ad group performance", groupReport.data, (row) => [
                row.metadata?.adGroupName || `#${row.metadata?.adGroupId || "—"}`,
                performance(row.total)
              ])
            )
          );
          details.dataset.loaded = "true";
        } catch (error) {
          details.textContent = error.message;
        }
      });
      return el("div", { className: "campaign" }, button, details);
    })
  );
}

function performance(total = {}) {
  const installs = total.totalInstalls ?? total.installs ?? 0;
  return `${fmt.format(Number(total.taps || 0))} taps · ${fmt.format(Number(installs))} installs · ${money(total.localSpend)}`;
}

function detailBox(title, items, map) {
  return el(
    "div",
    { className: "detail-box" },
    el("h3", {}, title),
    ...(items.length
      ? items.map((item) => {
          const [left, right] = map(item);
          return el("div", { className: "detail-row" }, el("span", {}, left), el("span", {}, right));
        })
      : [el("p", {}, "No records")])
  );
}

function cell(value) {
  return el(
    "td",
    {},
    value === undefined ? "—" : typeof value === "number" ? fmt.format(value) : String(value)
  );
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(
    ...children.map((child) => (child instanceof Node ? child : document.createTextNode(String(child))))
  );
  return node;
}

function notice(message) {
  $("#notice").textContent = message || "";
  $("#notice").classList.toggle("hidden", !message);
}

$("#refresh").addEventListener("click", refresh);
refresh();
