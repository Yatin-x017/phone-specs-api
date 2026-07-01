const json = (res, data) => {
    res.json({
        status: true,
        data,
    });
};

const errorJson = (res, error, status) => {
    // Allow errors thrown from scrapeClient (e.g. GSMArena 403/timeout) to
    // set their own, more accurate, HTTP status instead of always 500.
    const resolvedStatus = status || error?.status || 500;
    const message = error?.message || error;
    res.status(resolvedStatus).json({
        status: false,
        error: `Something went wrong: ${message}`,
    });
};

module.exports = {
    json,
    errorJson
}
