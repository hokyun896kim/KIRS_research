// 서버 전용: KIRS 목록 스크래핑 + PDF 본문 추출
import "server-only";
import * as cheerio from "cheerio";
import https from "node:https";
import { URL } from "node:url";

const LIST_BASE = "https://www.kirs.or.kr/research/research22_1.html";

export type Report = {
  no: string | null;
  name: string;
  code: string | null;
  title: string;
  author: string;
  date: string;
  pdfUrl: string | null;
};

export type ListResult = {
  total: number | null;
  page: number;
  pageCount: number | null;
  reports: Report[];
};

// KIRS는 인증서 체인 검증이 실패(unable to verify the first certificate)하므로
// 이 공개 사이트에 한해 rejectUnauthorized:false 로 우회한다.
function fetchInsecure(target: string, asBuffer = false, depth = 0): Promise<string | Buffer> {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error("too many redirects"));
    // 한글·특수문자(★ 등) 경로를 퍼센트 인코딩으로 정규화
    const normalized = new URL(target);
    const req = https.get(
      normalized,
      {
        rejectUnauthorized: false,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "*/*",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          const next = new URL(res.headers.location, target).toString();
          res.resume();
          return resolve(fetchInsecure(next, asBuffer, depth + 1));
        }
        if (status >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${status} for ${target}`));
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve(asBuffer ? buf : buf.toString("utf-8"));
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(25000, () => req.destroy(new Error("timeout")));
  });
}

// PDF는 KIRS 도메인만 허용 (임의 URL 프록시 방지)
export function isAllowedPdfUrl(u: string): boolean {
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === "https:" && (hostname === "kirs.or.kr" || hostname.endsWith(".kirs.or.kr"));
  } catch {
    return false;
  }
}

// area: subject(제목) | worker(작성자) | content(내용)
export async function fetchList(page = 1, area = "", keyword = ""): Promise<ListResult> {
  const qs = new URLSearchParams({ dbname: "research", page: String(page), mode: "search", area, keyword });
  const html = (await fetchInsecure(`${LIST_BASE}?${qs.toString()}`)) as string;
  const $ = cheerio.load(html);

  const reports: Report[] = [];
  $("table tr").each((_, tr) => {
    const td = $(tr).find("td");
    if (td.length < 5) return;
    // "코스메카코리아 (241710)" → 종목명 + 코드
    const nameCell = $(td[0]).text().replace(/\s+/g, " ").trim();
    const m = nameCell.match(/^(.*?)\s*\(([0-9A-Z]{6})\)$/);
    const a = $(td[4]).find("a");
    const hit = (a.find("img").attr("onclick") ?? "").match(/add_hit\((\d+)\)/);
    reports.push({
      no: hit ? hit[1] : null,
      name: m ? m[1] : nameCell,
      code: m ? m[2] : null,
      title: $(td[1]).text().replace(/\s+/g, " ").trim(),
      author: $(td[2]).text().replace(/\s+/g, " ").trim(),
      date: $(td[3]).text().trim(),
      pdfUrl: a.attr("href")?.trim() || null,
    });
  });

  const totalText = $("p.searchdata span").first().text().replace(/[^0-9]/g, "");
  const total = totalText ? Number(totalText) : null;
  return { total, page, pageCount: total != null ? Math.max(1, Math.ceil(total / 10)) : null, reports };
}

export async function extractPdf(url: string): Promise<{ pages: number | null; text: string }> {
  const buf = (await fetchInsecure(url, true)) as Buffer;
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { pages: totalPages ?? null, text };
}

// 1면 "Analyst 채윤석 … RA 정수현" 표기에서 주 애널·보조(RA) 식별
export function detectAuthors(text: string): { analyst: string | null; ra: string | null } {
  const a = text.match(/Analyst\s*([가-힣]{2,4})/);
  const r = text.match(/\bRA\s*([가-힣]{2,4})/);
  return { analyst: a ? a[1] : null, ra: r ? r[1] : null };
}
