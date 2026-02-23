// Cloudflare Worker for website submission (模块模式)
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 允许CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response('OK', {
        headers: corsHeaders,
      });
    }

    // 处理API请求：如果是POST请求到worker.js，或者路径以/api/开头
    if (request.method === 'POST' && (path.endsWith('/worker.js') || path.startsWith('/api/'))) {
      return await this.handleApiRequest(request, env, corsHeaders);
    }

    // 处理静态资源请求
    if (path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.svg')) {
      return await this.serveStaticFile(path, env);
    }

    // 主入口返回index.html
    return await this.serveStaticFile('/index.html', env);
  },

  async handleApiRequest(request, env, corsHeaders) {
    // 只允许POST请求
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      const data = await request.json();
      const action = data.action;

      switch (action) {
        case 'get':
          return await this.handleGetRequest(env, corsHeaders);
        case 'add':
          return await this.handleAddRequest(data.data, env, corsHeaders);
        case 'update':
          return await this.handleUpdateRequest(data.data, data.index, env, corsHeaders);
        case 'delete':
          return await this.handleDeleteRequest(data.id, env, corsHeaders);
        default:
          return new Response('Invalid action', {
            status: 400,
            headers: corsHeaders,
          });
      }
    } catch (error) {
      return new Response('Error processing request', {
        status: 500,
        headers: corsHeaders,
      });
    }
  },

  async handleGetRequest(env, corsHeaders) {
    try {
      const websites = await env.WEBSITES_KV.get('websites');
      return new Response(JSON.stringify({ websites: websites ? JSON.parse(websites) : [] }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } catch (error) {
      return new Response('Error getting websites', {
        status: 500,
        headers: corsHeaders,
      });
    }
  },

  async handleAddRequest(websiteData, env, corsHeaders) {
    try {
      const websites = await env.WEBSITES_KV.get('websites');
      const websitesArray = websites ? JSON.parse(websites) : [];
      websitesArray.push(websiteData);
      await env.WEBSITES_KV.put('websites', JSON.stringify(websitesArray));
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } catch (error) {
      return new Response('Error adding website', {
        status: 500,
        headers: corsHeaders,
      });
    }
  },

  async handleUpdateRequest(websiteData, index, env, corsHeaders) {
    try {
      const websites = await env.WEBSITES_KV.get('websites');
      const websitesArray = websites ? JSON.parse(websites) : [];
      if (index >= 0 && index < websitesArray.length) {
        websitesArray[index] = websiteData;
        await env.WEBSITES_KV.put('websites', JSON.stringify(websitesArray));
        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      } else {
        return new Response('Invalid index', {
          status: 400,
          headers: corsHeaders,
        });
      }
    } catch (error) {
      return new Response('Error updating website', {
        status: 500,
        headers: corsHeaders,
      });
    }
  },

  async handleDeleteRequest(websiteId, env, corsHeaders) {
    try {
      const websites = await env.WEBSITES_KV.get('websites');
      const websitesArray = websites ? JSON.parse(websites) : [];
      const filteredWebsites = websitesArray.filter(website => website.id !== websiteId);
      await env.WEBSITES_KV.put('websites', JSON.stringify(filteredWebsites));
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } catch (error) {
      return new Response('Error deleting website', {
        status: 500,
        headers: corsHeaders,
      });
    }
  },

  async serveStaticFile(path, env) {
    try {
      // 移除开头的斜杠
      const filePath = path.startsWith('/') ? path.slice(1) : path;
      
      // 尝试从KV中获取文件
      const fileContent = await env.WEBSITES_KV.get(filePath);
      if (fileContent) {
        return new Response(fileContent, {
          headers: {
            'Content-Type': this.getContentType(filePath),
          },
        });
      }

      // 如果KV中没有，返回404
      return new Response('File not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    } catch (error) {
      return new Response('Error serving file', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
  },

  getContentType(filePath) {
    if (filePath.endsWith('.html')) return 'text/html';
    if (filePath.endsWith('.css')) return 'text/css';
    if (filePath.endsWith('.js')) return 'application/javascript';
    if (filePath.endsWith('.png')) return 'image/png';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
    if (filePath.endsWith('.svg')) return 'image/svg+xml';
    return 'application/octet-stream';
  }
};
