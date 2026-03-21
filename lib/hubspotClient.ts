/**
 * HubSpot Integration API Client
 * This satisfies the 'Data Ingestion Layer' and 'ETL Pipeline' design
 * by connecting to the REST API, fetching data with pagination,
 * and preparing it for tenant-based isolation tracking.
 */

const HUBSPOT_API_URL = "https://api.hubapi.com";

// Ensures headers inject the securely stored API token
function getHeaders() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing HUBSPOT_ACCESS_TOKEN in your environment variables. Please provide your Private App Access Token.");
  }
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * An ETL function to fetch deals from HubSpot in batches, utilizing pagination.
 * "A background ETL service fetches deal data in batches, handles pagination..."
 * 
 * @param after The pagination cursor for fetching the next batch
 * @param limit The maximum number of deals per batch (max usually 100)
 */
export async function fetchDealsEtlBatch(after?: string, limit: number = 100) {
  let url = `${HUBSPOT_API_URL}/crm/v3/objects/deals?limit=${limit}`;
  
  // We specify exactly which CRM properties our Intelligence & Processing layer needs
  const properties = [
    "amount",
    "dealname",
    "dealstage",
    "closedate",
    "hubspot_owner_id"
  ];
  
  url += `&properties=${properties.join(",")}`;

  if (after) {
    url += `&after=${after}`;
  }

  try {
    const response = await fetch(url, { headers: getHeaders() });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HubSpot ETL] Fetch failed with status ${response.status}: ${errorText}`);
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      results: data.results,           // The raw payload
      paging: data.paging,             // Used for the next chronological batch
      totalSynced: data.results.length
    };
  } catch (error) {
    console.error(`[HubSpot ETL] Extraction failed:`, error);
    throw error;
  }
}

/**
 * Example usage: Synchronizing a single Tenant's deals
 * "Tenant isolation is enforced at the database and application level using organization identifiers."
 */
export async function syncTenantDeals(organizationId: string) {
  let hasMore = true;
  let cursor: string | undefined = undefined;
  let totalProcessed = 0;

  console.log(`[ETL Pipeline] Starting full deal extraction for Tenant Org ID: ${organizationId}`);

  while (hasMore) {
    // 1. EXTRACT: Fetch the next batch
    const batchData = await fetchDealsEtlBatch(cursor, 100);
    
    // 2. TRANSFORM & LOAD: Map to local representations and save safely into isolated schemas
    for (const deal of batchData.results) {
        // Here you would insert/update your POSTGRES database via your 'lib/db.ts'
        // Example structure for DB insert mapping:
        const mappedDeal = {
            organization_id: organizationId, // Critically enforces Multi-Tenancy!
            hubspot_id: deal.id,
            name: deal.properties.dealname,
            amount: parseFloat(deal.properties.amount || "0"),
            stage: deal.properties.dealstage,
            close_date: deal.properties.closedate
        };

        // -> await db.query('INSERT INTO deals ...', [...])
    }
    
    totalProcessed += batchData.results.length;

    if (batchData.paging && batchData.paging.next && batchData.paging.next.after) {
      cursor = batchData.paging.next.after;
    } else {
      hasMore = false;
    }
  }

  console.log(`[ETL Pipeline] Synced ${totalProcessed} total jobs in near real-time batches for tenant.`);
  return totalProcessed;
}
