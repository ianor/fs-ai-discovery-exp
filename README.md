# FamilySearch API MCP Server

This is a Model Context Protocol (MCP) server that wraps the FamilySearch API, providing access to genealogical data through a standardized interface.

## Features

- Search for people in the FamilySearch Family Tree
- Get portraits/photos for a person
- Get ancestry information for a person

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Usage with Claude Desktop

1. Add the following configuration to your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "familysearch": {
         "command": "node",
         "args": [
           "/path/to/build/index.js"
         ]
       }
     }
   }
   ```
2. Restart Claude Desktop

## FamilySearch Authentication

This server requires a FamilySearch API access token to function. You can obtain one by:
1. Creating a FamilySearch developer account
2. Registering your application
3. Following the OAuth2 authentication flow

## Available Tools

### search-people
Search for people in the FamilySearch Family Tree. Parameters:
- `accessToken`: FamilySearch API access token
- `givenName`: (optional) Person's given (first) name
- `surname`: (optional) Person's surname (last name)
- `gender`: (optional) Person's gender (M/F)
- `birthPlace`: (optional) Place of birth
- `birthYear`: (optional) Year of birth
- `deathPlace`: (optional) Place of death
- `deathYear`: (optional) Year of death

### get-portraits
Get portrait pictures for a person. Parameters:
- `accessToken`: FamilySearch API access token
- `personId`: FamilySearch person ID

### get-ancestry
Get ancestry information for a person. Parameters:
- `accessToken`: FamilySearch API access token
- `personId`: FamilySearch person ID
- `generations`: (optional) Number of generations to retrieve (1-8, default 4)

## License

ISC
