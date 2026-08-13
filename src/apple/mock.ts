import type { AppleAdsGateway } from "./client.js";
import type { Account, AdGroup, Campaign, Keyword, ReportRow } from "./types.js";

export class MockAppleAdsGateway implements AppleAdsGateway {
  accounts = async (): Promise<Account[]> => [
    {
      orgId: 123456789,
      orgName: "Haftra Demo",
      currency: "TRY",
      timeZone: "Europe/Istanbul",
      roleNames: ["API Account Read Only"]
    }
  ];
  campaigns = async (): Promise<Campaign[]> => [
    {
      id: 1001,
      name: "TR · Marka",
      status: "ENABLED",
      displayStatus: "RUNNING",
      countriesOrRegions: ["TR"],
      dailyBudgetAmount: { amount: "900", currency: "TRY" }
    },
    {
      id: 1002,
      name: "TR · Genel Aramalar",
      status: "PAUSED",
      displayStatus: "PAUSED",
      countriesOrRegions: ["TR"],
      dailyBudgetAmount: { amount: "600", currency: "TRY" }
    }
  ];
  adGroups = async (campaignId: string): Promise<AdGroup[]> => [
    {
      id: Number(`${campaignId}1`),
      campaignId: Number(campaignId),
      name: "Exact · High intent",
      status: "ENABLED",
      displayStatus: "RUNNING",
      defaultBidAmount: { amount: "18.50", currency: "TRY" }
    }
  ];
  keywords = async (): Promise<Keyword[]> => [
    {
      id: 301,
      adGroupId: 10011,
      text: "doz takip",
      status: "ACTIVE",
      matchType: "EXACT",
      bidAmount: { amount: "17.25", currency: "TRY" }
    },
    {
      id: 302,
      adGroupId: 10011,
      text: "ilaç hatırlatıcı",
      status: "ACTIVE",
      matchType: "BROAD",
      bidAmount: { amount: "12.00", currency: "TRY" }
    }
  ];
  campaignReport = async (): Promise<ReportRow[]> => [
    {
      metadata: { campaignId: 1001, campaignName: "TR · Marka" },
      total: {
        impressions: 18420,
        taps: 1470,
        installs: 582,
        localSpend: { amount: "12430.40", currency: "TRY" },
        avgCPT: { amount: "8.46", currency: "TRY" },
        tapInstallCPI: { amount: "21.36", currency: "TRY" },
        ttr: 0.0798,
        tapInstallRate: 0.3959
      }
    },
    {
      metadata: { campaignId: 1002, campaignName: "TR · Genel Aramalar" },
      total: {
        impressions: 9450,
        taps: 622,
        installs: 181,
        localSpend: { amount: "7150.20", currency: "TRY" },
        avgCPT: { amount: "11.50", currency: "TRY" },
        tapInstallCPI: { amount: "39.50", currency: "TRY" },
        ttr: 0.0658,
        tapInstallRate: 0.291
      }
    }
  ];
  adGroupReport = async (campaignId: string): Promise<ReportRow[]> => [
    {
      metadata: { campaignId: Number(campaignId), adGroupId: 10011, adGroupName: "Exact · High intent" },
      total: {
        impressions: 12100,
        taps: 1040,
        totalInstalls: 425,
        localSpend: { amount: "8420.25", currency: "TRY" },
        avgCPT: { amount: "8.10", currency: "TRY" },
        tapInstallCPI: { amount: "19.81", currency: "TRY" }
      }
    }
  ];
  keywordReport = async (campaignId: string): Promise<ReportRow[]> => [
    {
      metadata: {
        campaignId: Number(campaignId),
        keywordId: 301,
        keyword: "dose tracker",
        matchType: "EXACT"
      },
      total: {
        impressions: 7200,
        taps: 680,
        totalInstalls: 310,
        localSpend: { amount: "5140.80", currency: "TRY" },
        tapInstallCPI: { amount: "16.58", currency: "TRY" }
      }
    },
    {
      metadata: {
        campaignId: Number(campaignId),
        keywordId: 302,
        keyword: "medication reminder",
        matchType: "BROAD"
      },
      total: {
        impressions: 4900,
        taps: 360,
        totalInstalls: 115,
        localSpend: { amount: "3279.45", currency: "TRY" },
        tapInstallCPI: { amount: "28.52", currency: "TRY" }
      }
    }
  ];
  searchTermReport = async (campaignId: string): Promise<ReportRow[]> => [
    {
      metadata: { campaignId: Number(campaignId), searchTermText: "weekly dose tracker" },
      total: {
        impressions: 2150,
        taps: 224,
        totalInstalls: 108,
        localSpend: { amount: "1480.30", currency: "TRY" }
      }
    },
    {
      metadata: { campaignId: Number(campaignId), searchTermText: "injection reminder" },
      total: {
        impressions: 1740,
        taps: 160,
        totalInstalls: 61,
        localSpend: { amount: "1198.10", currency: "TRY" }
      }
    }
  ];
}
