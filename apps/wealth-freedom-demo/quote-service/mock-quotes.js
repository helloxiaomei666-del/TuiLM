const quoteCatalog = {
  fund: {
    "000300": {
      code: "000300",
      name: "沪深300指数基金",
      assetType: "fund",
      price: 1.2368,
      source: "local mock quote-service",
      message: "本地 Demo 基金估值",
    },
    TEST01: {
      code: "TEST01",
      name: "测试基金",
      assetType: "fund",
      price: 1.2188,
      source: "local mock quote-service",
      message: "本地 Demo 基金估值",
    },
  },
  stock: {
    "600000": {
      code: "600000",
      name: "示例股票",
      assetType: "stock",
      price: 8.88,
      source: "local mock quote-service",
      message: "本地 Demo 股票估值",
    },
  },
  bond: {
    "110007": {
      code: "110007",
      name: "示例债券基金",
      assetType: "bond",
      price: 1.1042,
      source: "local mock quote-service",
      message: "本地 Demo 债券估值",
    },
    "bond-demo": {
      code: "bond-demo",
      name: "中短债基金",
      assetType: "bond",
      price: 1.2012,
      source: "local mock quote-service",
      message: "本地 Demo 债券估值",
    },
  },
  commodity: {
    "gold-demo": {
      code: "gold-demo",
      name: "黄金资产",
      assetType: "commodity",
      price: 666.8,
      source: "local mock quote-service",
      message: "本地 Demo 黄金估值",
    },
  },
  gold: {
    AU9999: {
      code: "AU9999",
      name: "AU9999黄金",
      assetType: "gold",
      price: 668.2,
      source: "local mock quote-service",
      message: "本地 Demo 黄金估值",
    },
  },
};

const supportedTypes = Object.keys(quoteCatalog);

function normalizeType(type) {
  return String(type || "").trim().toLowerCase();
}

function normalizeCode(code) {
  return String(code || "").trim();
}

function buildQuote(row, priceTime) {
  return {
    code: row.code,
    name: row.name,
    assetType: row.assetType,
    price: row.price,
    priceTime,
    source: row.source,
    status: "ok",
    message: row.message,
  };
}

function findQuote(type, code, options) {
  const normalizedType = normalizeType(type);
  const normalizedCode = normalizeCode(code);
  const priceTime = options && options.priceTime ? options.priceTime : new Date().toISOString();

  if (!normalizedType) {
    return {
      ok: false,
      httpStatus: 400,
      errorCode: "missing_type",
      message: "type is required",
    };
  }

  if (!normalizedCode) {
    return {
      ok: false,
      httpStatus: 400,
      errorCode: "missing_code",
      message: "code is required",
    };
  }

  if (supportedTypes.indexOf(normalizedType) === -1) {
    return {
      ok: false,
      httpStatus: 400,
      errorCode: "unsupported_type",
      message: "unsupported quote type",
    };
  }

  const row = quoteCatalog[normalizedType][normalizedCode];
  if (!row) {
    return {
      ok: false,
      httpStatus: 404,
      errorCode: "quote_not_found",
      message: "quote not found",
    };
  }

  return {
    ok: true,
    httpStatus: 200,
    quote: buildQuote(row, priceTime),
  };
}

module.exports = {
  quoteCatalog,
  supportedTypes,
  findQuote,
};
