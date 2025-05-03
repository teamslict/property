module.exports = {
  zone: {
    name: "slict.lk",
    dns: [
      {
        name: "property",
        type: "CNAME",
        content: "db4e7968.slict-property-frontend.pages.dev",
        proxied: true,
        ttl: 1
      },
      {
        name: "apiproperty",
        type: "CNAME",
        content: "slict-property-production.slict-property.workers.dev",
        proxied: true,
        ttl: 1
      }
    ]
  },
  ssl: {
    mode: "full_strict",
    always_use_https: true,
    min_tls_version: "1.2"
  },
  workers: {
    script_name: "slict-property-production",
    custom_domains: ["apiproperty.slict.lk"]
  },
  pages: {
    project_name: "slict-property-frontend",
    custom_domains: ["property.slict.lk"]
  }
};