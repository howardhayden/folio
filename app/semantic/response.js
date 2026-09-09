const publicHeaders = {
  "cache-control": "public, max-age=0, must-revalidate",
  "x-content-type-options": "nosniff",
};

export function jsonArtifact(value, contentType = "application/json") {
  return new Response(`${JSON.stringify(value, null, 2)}\n`, {
    headers: { ...publicHeaders, "content-type": `${contentType}; charset=utf-8` },
  });
}

export function textArtifact(value, contentType = "text/plain") {
  return new Response(value, {
    headers: { ...publicHeaders, "content-type": `${contentType}; charset=utf-8` },
  });
}
