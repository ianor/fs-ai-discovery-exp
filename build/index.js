import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import fetch from "node-fetch";
import { z } from "zod";
// FamilySearch API base URLs
const FS_API_BASE = "https://www.familysearch.org/platform/tree/search";
const FS_PLATFORM_API = "https://www.familysearch.org/platform/tree/persons";
const FS_ANCESTRY_API = "https://www.familysearch.org/platform/tree/ancestry";
// Create server instance
const server = new McpServer({
    name: "familysearch",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});
// Function to search for people in the FamilySearch API
async function searchPeople(accessToken, query) {
    const params = new URLSearchParams();
    if (query.givenName)
        params.append("q.givenName", query.givenName);
    if (query.surname)
        params.append("q.surname", query.surname);
    if (query.gender)
        params.append("q.sex", query.gender);
    if (query.birthPlace)
        params.append("q.birthLikePlace", query.birthPlace);
    if (query.birthYear) {
        params.append("q.birthLikeDate.from", query.birthYear.toString());
        params.append("q.birthLikeDate.to", (query.birthYear + 1).toString());
    }
    if (query.deathPlace)
        params.append("q.deathLikePlace", query.deathPlace);
    if (query.deathYear) {
        params.append("q.deathLikeDate.from", query.deathYear.toString());
        params.append("q.deathLikeDate.to", (query.deathYear + 1).toString());
    }
    try {
        console.log(`${FS_API_BASE}?${params.toString()}`, `headers: {\n  Authorization: Bearer ${accessToken},\n  Accept: "application/json, text/event-stream"\n}`);
        const response = await fetch(`${FS_API_BASE}?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json, text/event-stream",
            },
        });
        if (!response.ok) {
            console.error("Error response from FamilySearch API:", response.statusText);
            console.error("Response body:", await response.text());
            throw new Error(`FamilySearch API error: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error("Error searching FamilySearch:", error);
        throw error;
    }
}
// Function to get portraits for a person
async function getPersonPortraits(accessToken, personId) {
    try {
        const response = await fetch(`${FS_PLATFORM_API}/${personId}/portraits`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json, text/event-stream",
            },
        });
        if (!response.ok) {
            throw new Error(`FamilySearch API error: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error("Error fetching portraits:", error);
        throw error;
    }
}
// Function to get a person's ancestry
async function getPersonAncestry(accessToken, personId, generations = 4) {
    try {
        const response = await fetch(`${FS_ANCESTRY_API}?person=${personId}&generations=${generations}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/x-gedcomx-v1+json, text/event-stream",
            },
        });
        if (!response.ok) {
            throw new Error(`FamilySearch API error: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error("Error fetching ancestry:", error);
        throw error;
    }
}
// Register the search tool
server.tool("search-people", "Search for people in FamilySearch's Family Tree", {
    accessToken: z.string().describe("FamilySearch API access token"),
    givenName: z.string().optional().describe("Person's given (first) name"),
    surname: z.string().optional().describe("Person's surname (last name)"),
    gender: z.string().optional().describe("Person's gender (M/F)"),
    birthPlace: z.string().optional().describe("Place of birth"),
    birthYear: z.number().optional().describe("Year of birth"),
    deathPlace: z.string().optional().describe("Place of death"),
    deathYear: z.number().optional().describe("Year of death"),
}, async ({ accessToken, ...searchParams }) => {
    try {
        console.log("Searching Family Tree with params:", searchParams);
        const results = await searchPeople(accessToken, searchParams);
        const formattedResults = formatSearchResults(results);
        console.log("Formatted results:", formattedResults);
        return {
            content: [
                {
                    type: "text",
                    text: formattedResults,
                },
            ],
        };
    }
    catch (err) {
        const error = err;
        return {
            content: [
                {
                    type: "text",
                    text: `Error searching FamilySearch: ${error.message}`,
                },
            ],
        };
    }
});
// Function to format search results into a readable string
function formatSearchResults(results) {
    if (!results.entries || results.entries.length === 0) {
        return "No results found.";
    }
    return results.entries
        .map((entry) => {
        const person = entry.content.gedcomx.persons[0];
        const name = person.names[0].nameForms[0].fullText;
        const gender = person.gender?.type === "http://gedcomx.org/Male" ? "Male" : "Female";
        const facts = person.facts || [];
        const birth = facts.find((f) => f.type === "http://gedcomx.org/Birth");
        const death = facts.find((f) => f.type === "http://gedcomx.org/Death");
        const birthInfo = birth ? `Born: ${birth.date?.original || "Unknown"} at ${birth.place?.original || "Unknown"}` : "Birth: Unknown";
        const deathInfo = death ? `Died: ${death.date?.original || "Unknown"} at ${death.place?.original || "Unknown"}` : "Death: Unknown";
        return `
Person: ${name}
Gender: ${gender}
${birthInfo}
${deathInfo}
FamilySearch ID: ${person.id}
---`;
    })
        .join("\n");
}
// Function to format portrait results into a readable string
function formatPortraitResults(results) {
    if (!results.portraits || results.portraits.length === 0) {
        return "No portraits found for this person.";
    }
    return results.portraits.map((portrait, index) => {
        const description = portrait.description || "No description";
        const url = portrait.links?.["image-url-high-res"]?.href ||
            portrait.links?.["image-url"]?.href ||
            "No URL available";
        return `
Portrait ${index + 1}:
Description: ${description}
URL: ${url}
---`;
    }).join("\n");
}
// Function to format ancestry results into a readable string
function formatAncestryResults(results) {
    if (!results.persons || results.persons.length === 0) {
        return "No ancestry information found.";
    }
    const relationships = results.relationships || [];
    const personMap = new Map(results.persons.map((p) => [p.id, p]));
    // Find parent-child relationships
    const childToParents = new Map();
    relationships
        .filter((rel) => rel.type === "http://gedcomx.org/ParentChild")
        .forEach((rel) => {
        const childId = rel.person2.resourceId;
        if (!childToParents.has(childId)) {
            childToParents.set(childId, []);
        }
        childToParents.get(childId).push(rel.person1.resourceId);
    });
    // Function to format a single person's details
    function formatPerson(person) {
        const name = person.names?.[0]?.nameForms?.[0]?.fullText || "Unknown";
        const facts = person.facts || [];
        const birth = facts.find((f) => f.type === "http://gedcomx.org/Birth");
        const death = facts.find((f) => f.type === "http://gedcomx.org/Death");
        const birthInfo = birth ? `Born: ${birth.date?.original || "Unknown"} at ${birth.place?.original || "Unknown"}` : "Birth: Unknown";
        const deathInfo = death ? `Died: ${death.date?.original || "Unknown"} at ${death.place?.original || "Unknown"}` : "Death: Unknown";
        return `${name}
${birthInfo}
${deathInfo}
ID: ${person.id}`;
    }
    // Function to build ancestry tree string
    function buildAncestryTree(personId, level = 0) {
        const person = personMap.get(personId);
        if (!person)
            return "";
        const indent = "  ".repeat(level);
        const personDetails = formatPerson(person);
        let result = `${indent}${personDetails}\n`;
        const parents = childToParents.get(personId) || [];
        for (const parentId of parents) {
            result += `${indent}---\n${buildAncestryTree(parentId, level + 1)}`;
        }
        return result;
    }
    // Start with the first person (should be the requested person)
    const rootPerson = results.persons[0];
    return buildAncestryTree(rootPerson.id);
}
// Register the portraits tool
server.tool("get-portraits", "Get portrait pictures for a person in FamilySearch's Family Tree", {
    accessToken: z.string().describe("FamilySearch API access token"),
    personId: z.string().describe("FamilySearch person ID"),
}, async ({ accessToken, personId }) => {
    try {
        const results = await getPersonPortraits(accessToken, personId);
        const formattedResults = formatPortraitResults(results);
        return {
            content: [
                {
                    type: "text",
                    text: formattedResults,
                },
            ],
        };
    }
    catch (err) {
        const error = err;
        return {
            content: [
                {
                    type: "text",
                    text: `Error fetching portraits: ${error.message}`,
                },
            ],
        };
    }
});
// Register the ancestry tool
server.tool("get-ancestry", "Get ancestry information for a person in FamilySearch's Family Tree", {
    accessToken: z.string().describe("FamilySearch API access token"),
    personId: z.string().describe("FamilySearch person ID"),
    generations: z.number().min(1).max(8).optional().describe("Number of generations to retrieve (1-8, default 4)"),
}, async ({ accessToken, personId, generations = 4 }) => {
    try {
        const results = await getPersonAncestry(accessToken, personId, generations);
        const formattedResults = formatAncestryResults(results);
        return {
            content: [
                {
                    type: "text",
                    text: formattedResults,
                },
            ],
        };
    }
    catch (err) {
        const error = err;
        return {
            content: [
                {
                    type: "text",
                    text: `Error fetching ancestry: ${error.message}`,
                },
            ],
        };
    }
});
// Run the server
async function main() {
    const app = express();
    app.use(express.json());
    // Create MCP server route
    app.post('/mcp', async (req, res) => {
        try {
            // Create new transport instance for each request to ensure isolation
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
            });
            // Handle request cleanup
            res.on('close', () => {
                console.log('Request closed');
                transport.close();
            });
            // Connect transport to server and handle request
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        }
        catch (error) {
            console.error('Error handling MCP request:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error',
                    },
                    id: null,
                });
            }
        }
    });
    // Add GET handler to properly handle method not allowed
    app.get('/mcp', async (req, res) => {
        console.log('Received GET MCP request');
        res.status(405).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Method not allowed.'
            },
            id: null
        });
    });
    // Start the server
    app.listen(process.env.PORT || 3000, () => {
        console.error(`FamilySearch MCP Server running on HTTP at port ${process.env.PORT || 3000}`);
    });
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
