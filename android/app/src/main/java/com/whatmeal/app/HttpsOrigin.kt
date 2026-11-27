package com.whatmeal.app

import java.net.URI
import java.net.URISyntaxException

internal class HttpsOrigin(origin: String) {
    private val service = URI(origin)

    fun allows(url: String): Boolean {
        val candidate = try {
            URI(url)
        } catch (_: URISyntaxException) {
            return false
        }
        val host = candidate.host ?: return false
        val port = candidate.port
        val authority = if (port == -1) host else "$host:$port"
        return candidate.scheme.equals("https", ignoreCase = true) &&
            candidate.rawAuthority == authority &&
            host.equals(service.host, ignoreCase = true) &&
            effectivePort(port) == effectivePort(service.port)
    }

    private fun effectivePort(port: Int): Int = if (port == -1) 443 else port
}
