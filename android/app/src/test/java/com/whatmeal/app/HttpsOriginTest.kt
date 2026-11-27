package com.whatmeal.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HttpsOriginTest {
    private val origin = HttpsOrigin("https://meals.example")

    @Test
    fun allowsPathsAndExplicitDefaultPort() {
        assertTrue(origin.allows("https://MEALS.example:443/login?callbackUrl=%2Fmeals"))
        assertTrue(origin.allows("https://meals.example/meals#today"))
    }

    @Test
    fun rejectsOtherSchemesHostsAndPorts() {
        assertFalse(origin.allows("http://meals.example/login"))
        assertFalse(origin.allows("https://other.meals.example/login"))
        assertFalse(origin.allows("https://meals.example:8443/login"))
        assertFalse(origin.allows("file:///login"))
        assertFalse(origin.allows("about:blank"))
    }

    @Test
    fun rejectsAmbiguousAndMalformedAuthorities() {
        assertFalse(origin.allows("https://other.example@meals.example/login"))
        assertFalse(origin.allows("https://meals.example@other.example/login"))
        assertFalse(origin.allows("https://meals.example:/login"))
        assertFalse(origin.allows("https://meals.example:65536/login"))
        assertFalse(origin.allows("https://meals.example\\@other.example/login"))
        assertFalse(origin.allows("/login"))
    }

    @Test
    fun requiresTheConfiguredNonDefaultPort() {
        val customPort = HttpsOrigin("https://meals.example:8443")
        assertTrue(customPort.allows("https://meals.example:8443/login"))
        assertFalse(customPort.allows("https://meals.example/login"))
    }
}
