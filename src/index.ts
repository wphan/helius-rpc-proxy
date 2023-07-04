interface Env {
	CORS_ALLOW_ORIGIN: string;
	HELIUS_API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env) {

		// If the request is an OPTIONS request, return a 200 response with permissive CORS headers
		// This is required for the Helius RPC Proxy to work from the browser and arbitrary origins
		// If you wish to restrict the origins that can access your Helius RPC Proxy, you can do so by
		// changing the `*` in the `Access-Control-Allow-Origin` header to a specific origin.
		// For example, if you wanted to allow requests from `https://example.com`, you would change the
		// header to `https://example.com`. Multiple domains are supported by verifying that the request
		// originated from one of the domains in the `CORS_ALLOW_ORIGIN` environment variable.
		const supportedDomains = env.CORS_ALLOW_ORIGIN ? env.CORS_ALLOW_ORIGIN.split(',').map(pattern => new RegExp(pattern.replace(/\*/g, '.*'))) : undefined;
		const corsHeaders: Record<string, string> = {
			"Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
			"Access-Control-Allow-Headers": "*",
		}

		let originAllowed = false;
		if (supportedDomains) {
			const origin = request.headers.get('Origin')
			if (origin && supportedDomains.some(pattern => pattern.test(origin))) {
				corsHeaders['Access-Control-Allow-Origin'] = origin
				originAllowed = true;
			}
		} else {
			corsHeaders['Access-Control-Allow-Origin'] = '*'
			originAllowed = true;
		}

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 200,
				headers: corsHeaders,
			});
		}

		if (!originAllowed) {
			return new Response('Forbidden', { status: 403 });
		}

		const upgradeHeader = request.headers.get('Upgrade')
		if (upgradeHeader || upgradeHeader === 'websocket') {
			return await fetch(`https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`, request)
		}

		const { pathname, search } = new URL(request.url)
		const payload = await request.text();
		const proxyRequest = new Request(`https://${pathname === '/' ? 'rpc' : 'api'}.helius.xyz${pathname}?api-key=${env.HELIUS_API_KEY}${search ? `&${search.slice(1)}` : ''}`, {
			method: request.method,
			body: payload || null,
			headers: {
				'Content-Type': 'application/json',
				'X-Helius-Cloudflare-Proxy': 'true',
				...corsHeaders,
			}
		});

		return await fetch(proxyRequest);
	},
};
