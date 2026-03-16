(function () {
  const vsSource = `
    attribute vec4 aVertexPosition;
    void main() {
      gl_Position = aVertexPosition;
    }
  `;

  const fsSource = `
    precision highp float;
    uniform vec2 iResolution;
    uniform float iTime;
    uniform vec3 iLineColor;
    uniform float iLineOpacity;

    const float overallSpeed = 0.2;
    const float gridSmoothWidth = 0.015;
    const float axisWidth = 0.05;
    const float majorLineWidth = 0.025;
    const float minorLineWidth = 0.0125;
    const float majorLineFrequency = 5.0;
    const float minorLineFrequency = 1.0;
    const vec4 gridColor = vec4(0.5);
    const float scale = 5.0;
    const float minLineWidth = 0.01;
    const float maxLineWidth = 0.2;
    const float lineSpeed = 1.0 * overallSpeed;
    const float lineAmplitude = 1.0;
    const float lineFrequency = 0.2;
    const float warpSpeed = 0.2 * overallSpeed;
    const float warpFrequency = 0.5;
    const float warpAmplitude = 1.0;
    const float offsetFrequency = 0.5;
    const float offsetSpeed = 1.33 * overallSpeed;
    const float minOffsetSpread = 0.6;
    const float maxOffsetSpread = 2.0;
    const int linesPerGroup = 16;

    #define drawCircle(pos, radius, coord) smoothstep(radius + gridSmoothWidth, radius, length(coord - (pos)))
    #define drawSmoothLine(pos, halfWidth, t) smoothstep(halfWidth, 0.0, abs(pos - (t)))
    #define drawCrispLine(pos, halfWidth, t) smoothstep(halfWidth + gridSmoothWidth, halfWidth, abs(pos - (t)))
    #define drawPeriodicLine(freq, width, t) drawCrispLine(freq / 2.0, width, abs(mod(t, freq) - (freq) / 2.0))

    float drawGridLines(float axis) {
      return drawCrispLine(0.0, axisWidth, axis)
            + drawPeriodicLine(majorLineFrequency, majorLineWidth, axis)
            + drawPeriodicLine(minorLineFrequency, minorLineWidth, axis);
    }

    float drawGrid(vec2 space) {
      return min(1.0, drawGridLines(space.x) + drawGridLines(space.y));
    }

    float random(float t) {
      return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0;
    }

    float getPlasmaY(float x, float horizontalFade, float offset) {
      return random(x * lineFrequency + iTime * lineSpeed) * horizontalFade * lineAmplitude + offset;
    }

    void main() {
      vec2 fragCoord = gl_FragCoord.xy;
      vec4 fragColor;
      vec2 uv = fragCoord.xy / iResolution.xy;
      vec2 space = (fragCoord - iResolution.xy / 2.0) / iResolution.x * 2.0 * scale;

      float horizontalFade = 1.0 - (cos(uv.x * 6.28) * 0.5 + 0.5);
      float verticalFade = 1.0 - (cos(uv.y * 6.28) * 0.5 + 0.5);

      space.y += random(space.x * warpFrequency + iTime * warpSpeed) * warpAmplitude * (0.5 + horizontalFade);
      space.x += random(space.y * warpFrequency + iTime * warpSpeed + 2.0) * warpAmplitude * horizontalFade;

      vec4 lines = vec4(0.0);

      for(int l = 0; l < linesPerGroup; l++) {
        float normalizedLineIndex = float(l) / float(linesPerGroup);
        float offsetTime = iTime * offsetSpeed;
        float offsetPosition = float(l) + space.x * offsetFrequency;
        float rand = random(offsetPosition + offsetTime) * 0.5 + 0.5;
        float halfWidth = mix(minLineWidth, maxLineWidth, rand * horizontalFade) / 2.0;
        float offset = random(offsetPosition + offsetTime * (1.0 + normalizedLineIndex)) * mix(minOffsetSpread, maxOffsetSpread, horizontalFade);
        float linePosition = getPlasmaY(space.x, horizontalFade, offset);
        float line = drawSmoothLine(linePosition, halfWidth, space.y) / 2.0 + drawCrispLine(linePosition, halfWidth * 0.15, space.y);

        float circleX = mod(float(l) + iTime * lineSpeed, 25.0) - 12.0;
        vec2 circlePosition = vec2(circleX, getPlasmaY(circleX, horizontalFade, offset));
        float circle = drawCircle(circlePosition, 0.01, space) * 4.0;

        line = line + circle;
        lines += line * vec4(iLineColor, 1.0) * rand;
      }

      vec3 lineRgb = lines.rgb * verticalFade * iLineOpacity;
      float lineAlpha = clamp(max(max(lineRgb.r, lineRgb.g), lineRgb.b), 0.0, 1.0);
      fragColor = vec4(lineRgb, lineAlpha);

      gl_FragColor = fragColor;
    }
  `;

  function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  function initShaderProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) return null;

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      console.error("Shader program link error:", gl.getProgramInfoLog(shaderProgram));
      return null;
    }

    return shaderProgram;
  }

  function initShaderBackground(canvasId = "shader-background", options = {}) {
    const settings = {
      disableBelowWidth: 640,
      disableForReducedMotion: true,
      maxDevicePixelRatio: 1.5,
      ...options
    };

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn(`Canvas with id "${canvasId}" not found.`);
      return;
    }

    const shouldDisableForViewport = Number.isFinite(settings.disableBelowWidth)
      && window.innerWidth < settings.disableBelowWidth;
    const shouldDisableForMotion = settings.disableForReducedMotion
      && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (shouldDisableForViewport || shouldDisableForMotion) {
      canvas.style.display = "none";
      return;
    }

    const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
    if (!gl) {
      console.warn("WebGL not supported.");
      canvas.style.display = "none";
      return;
    }

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    if (!shaderProgram) return;

    function hexToRgb(hex) {
      const cleaned = (hex || "").trim().replace(/^#/, "");
      if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
      const value = parseInt(cleaned, 16);
      return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
      };
    }

    function mixRgb(a, b, t) {
      const blend = Math.min(1, Math.max(0, t));
      return {
        r: a.r + (b.r - a.r) * blend,
        g: a.g + (b.g - a.g) * blend,
        b: a.b + (b.b - a.b) * blend
      };
    }

    function toVec3(color) {
      return [color.r / 255, color.g / 255, color.b / 255];
    }

    function getThemeLineSettings() {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      const primary = hexToRgb(styles.getPropertyValue("--primary")) || { r: 26, g: 159, b: 255 };
      const secondary = hexToRgb(styles.getPropertyValue("--secondary")) || { r: 139, g: 92, b: 246 };
      const fg = hexToRgb(styles.getPropertyValue("--fg")) || { r: 11, g: 18, b: 32 };
      const isDark = root.getAttribute("data-theme") === "dark";

      const baseBlend = mixRgb(primary, secondary, isDark ? 0.56 : 0.40);
      const tuned = mixRgb(baseBlend, fg, isDark ? 0.12 : 0.20);

      return {
        color: toVec3(tuned),
        opacity: isDark ? 0.22 : 0.10
      };
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    const positions = [
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition")
      },
      uniformLocations: {
        resolution: gl.getUniformLocation(shaderProgram, "iResolution"),
        time: gl.getUniformLocation(shaderProgram, "iTime"),
        lineColor: gl.getUniformLocation(shaderProgram, "iLineColor"),
        lineOpacity: gl.getUniformLocation(shaderProgram, "iLineOpacity")
      }
    };

    let lineSettings = getThemeLineSettings();
    const themeObserver = new MutationObserver(function () {
      lineSettings = getThemeLineSettings();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"]
    });

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, settings.maxDevicePixelRatio || 1.5);
      const width = Math.floor(window.innerWidth * dpr);
      const height = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    }

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const startTime = performance.now();

    function render() {
      const currentTime = (performance.now() - startTime) / 1000;

      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(programInfo.program);

      gl.uniform2f(programInfo.uniformLocations.resolution, canvas.width, canvas.height);
      gl.uniform1f(programInfo.uniformLocations.time, currentTime);
      gl.uniform3f(
        programInfo.uniformLocations.lineColor,
        lineSettings.color[0],
        lineSettings.color[1],
        lineSettings.color[2]
      );
      gl.uniform1f(programInfo.uniformLocations.lineOpacity, lineSettings.opacity);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0
      );
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  window.initShaderBackground = initShaderBackground;
})();
