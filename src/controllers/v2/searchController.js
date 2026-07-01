const cheerio = require("cheerio");
const { json, errorJson } = require("../../utils/response");
const { fetchResponse } = require("../../utils/scrapeClient");

exports.index = async (req, res) => {
  try {
    const q = req.query.query;
    if (!q) return errorJson(res, "Please provide query search!", 400);

    const url = `${process.env.BASE_URL}/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(q)}`;

    const { html: htmlResult, url: finalUrl } = await fetchResponse(url);

    const $ = cheerio.load(htmlResult);
    const phones = [];

    $(".makers")
      .children("ul")
      .children("li")
      .each((_i, el) => {
        const href = $(el).children("a").attr("href") || "";
        const slug = href.replace(".php", "");
        const image = $(el).find("img").attr("src") || "";
        const anchor = $(el).children("a");
        const br = anchor.find("br").get(0);
        let phone_name = br ? br.nextSibling?.nodeValue?.trim() : "";
        let brand = anchor.children("span").first().text().trim();
        // Fallback: some list markups don't have a leading <span>/<br> split,
        // just "Brand Name" text inside the anchor.
        if (!phone_name) {
          const fullText = anchor.text().replace(/\s+/g, " ").trim();
          if (brand && fullText.startsWith(brand)) {
            phone_name = fullText.slice(brand.length).trim();
          } else {
            phone_name = fullText;
          }
        }
        if (phone_name) {
          phones.push({ brand, phone_name, slug, image });
        }
      });

    // When a query matches one phone closely enough, GSMArena's quick
    // search redirects straight to that phone's spec page instead of
    // showing a results list — so the .makers list above is empty even
    // though we got a perfectly valid, on-topic page back. Detect that
    // and synthesize a single-item result instead of reporting "no results".
    if (phones.length === 0) {
      const specTitle = $("h1.specs-phone-name-title").text().trim();
      if (specTitle) {
        const image = $(".specs-photo-main").find("img").attr("src") || "";
        const slug = finalUrl
          .replace(/^.*\//, "")
          .replace(/\.php.*$/, "")
          .replace(/\?.*$/, "");
        const brand = specTitle.split(" ")[0];
        const phone_name = specTitle.slice(brand.length).trim();
        phones.push({ brand, phone_name, slug, image });
      }
    }

    return json(res, {
      title: `Search results for "${q}"`,
      phones,
      ...(phones.length === 0 && {
        _debug: {
          finalUrl,
          htmlLength: htmlResult.length,
          pageTitle: $("title").text().trim(),
          hasMakersDiv: $(".makers").length,
          hasSpecTitle: $("h1.specs-phone-name-title").length,
          bodySnippet: $("body").text().replace(/\s+/g, " ").trim().slice(0, 300),
        },
      }),
    });
  } catch (error) {
    return errorJson(res, error);
  }
};
