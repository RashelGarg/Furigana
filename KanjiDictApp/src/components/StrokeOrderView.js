import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { getKanjiVGUrl } from '../utils/kanjiUtils';

/**
 * Stroke Order component
 * - Web: fetches KanjiVG SVG and animates strokes using CSS/JS
 * - Shows playback controls
 */
export default function StrokeOrderView({ entry }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [svgData, setSvgData] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [speed, setSpeed] = useState(1);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (entry) {
      fetchStrokeOrder();
    }
  }, [entry]);

  const fetchStrokeOrder = async () => {
    const url = getKanjiVGUrl(entry);
    if (!url) {
      setError('No stroke data available');
      return;
    }
    setLoading(true);
    setError(null);
    setSvgData(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Stroke order not found');
      const text = await response.text();
      setSvgData(text);
    } catch (e) {
      setError('Stroke order unavailable');
    } finally {
      setLoading(false);
    }
  };

  const processedSVG = svgData
    ? buildAnimatedSVG(svgData, theme.strokeColor, theme.primary, speed)
    : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceAlt }]}>
      <Text style={[styles.title, { color: theme.text }]}>Stroke Order</Text>

      <View style={[styles.svgContainer, { borderColor: theme.border }]}>
        {loading && (
          <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
        )}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
            <TouchableOpacity onPress={fetchStrokeOrder}>
              <Text style={[styles.retryText, { color: theme.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {processedSVG && Platform.OS === 'web' && (
          <WebSVGAnimation svgHtml={processedSVG} speed={speed} />
        )}
      </View>

      {/* Controls */}
      {svgData && (
        <View style={styles.controls}>
          <Text style={[styles.controlLabel, { color: theme.textSecondary }]}>Speed:</Text>
          {[0.5, 1, 1.5, 2].map(s => (
            <TouchableOpacity
              key={s}
              style={[
                styles.speedBtn,
                { borderColor: theme.border },
                speed === s && { backgroundColor: theme.primary },
              ]}
              onPress={() => setSpeed(s)}
            >
              <Text style={[
                styles.speedText,
                { color: speed === s ? '#FFFFFF' : theme.textSecondary }
              ]}>{s}x</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.replayBtn, { backgroundColor: theme.primary }]}
            onPress={fetchStrokeOrder}
          >
            <Text style={styles.replayText}>↺ Replay</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/**
 * Web-only SVG animation component using dangerouslySetInnerHTML
 */
function WebSVGAnimation({ svgHtml, speed }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && svgHtml) {
      containerRef.current.innerHTML = svgHtml;
    }
  }, [svgHtml, speed]);

  if (Platform.OS !== 'web') return null;

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    />
  );
}

/**
 * Build an animated SVG from KanjiVG source
 * Adds CSS stroke-dasharray animation for each path
 */
function buildAnimatedSVG(svgText, strokeColor, accentColor, speed) {
  try {
    // Extract all path elements and animate them
    const totalDuration = (3 / speed).toFixed(2);
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return null;

    // Set SVG dimensions and style for display
    svg.setAttribute('width', '200');
    svg.setAttribute('height', '200');
    svg.style.background = 'white';
    svg.style.borderRadius = '8px';

    const paths = svg.querySelectorAll('path');
    const totalStrokes = paths.length;

    // Remove existing style/defs to avoid conflicts
    svg.querySelectorAll('style').forEach(el => el.remove());

    // Style each path for sequential animation
    let styleCSS = '';
    paths.forEach((path, i) => {
      const id = `stroke-${i}`;
      path.setAttribute('id', id);
      path.style.fill = 'none';
      path.style.stroke = strokeColor;
      path.style.strokeWidth = '3';
      path.style.strokeLinecap = 'round';
      path.style.strokeLinejoin = 'round';

      // Try to get path length
      const delay = (i / totalStrokes) * parseFloat(totalDuration);
      const dur = (1 / totalStrokes) * parseFloat(totalDuration) + 0.3;

      styleCSS += `
        #${id} {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: draw-${id} ${dur.toFixed(2)}s ease forwards;
          animation-delay: ${delay.toFixed(2)}s;
        }
        @keyframes draw-${id} {
          to { stroke-dashoffset: 0; }
        }
      `;

      // Number label at start of stroke
      if (path.getAttribute('d')) {
        // Parse first point of path
        const dAttr = path.getAttribute('d');
        const match = dAttr.match(/M\s*([\d.]+)[,\s]+([\d.]+)/i);
        if (match) {
          const x = parseFloat(match[1]);
          const y = parseFloat(match[2]);
          const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', x.toString());
          text.setAttribute('y', (y - 4).toString());
          text.setAttribute('font-size', '7');
          text.setAttribute('fill', accentColor);
          text.setAttribute('font-family', 'sans-serif');
          text.setAttribute('font-weight', 'bold');
          text.style.animation = `fadein ${0.3}s ease forwards`;
          text.style.animationDelay = `${delay.toFixed(2)}s`;
          text.style.opacity = '0';
          text.textContent = (i + 1).toString();
          svg.appendChild(text);
        }
      }
    });

    // Add fade-in for numbers
    styleCSS += `
      @keyframes fadein { to { opacity: 1; } }
    `;

    // Inject style
    const styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = styleCSS;
    svg.insertBefore(styleEl, svg.firstChild);

    // Serialize
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  } catch (e) {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  svgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  loader: {
    padding: 40,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  replayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 4,
  },
  replayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
