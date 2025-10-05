// craco.config.js
const path = require("path");
const fs = require("fs");
const express = require("express");
const { execSync } = require("child_process");

// Environment variable overrides
const config = {
  disableHotReload: process.env.DISABLE_HOT_RELOAD === "true",
};

// 🔍 Read Supervisor code-server password from conf.d
function getCodeServerPassword() {
  try {
    const conf = fs.readFileSync(
      "/etc/supervisor/conf.d/supervisord_code_server.conf",
      "utf8",
    );

    // Match environment=PASSWORD="value"
    const match = conf.match(/PASSWORD="([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

const SUP_PASS = getCodeServerPassword();

// Babel plugin for JSX transformation - adds metadata to all elements
const babelMetadataPlugin = ({ types: t }) => {
  const fileNameCache = new Map();
  const processedNodes = new WeakSet(); // Track processed nodes to prevent infinite loops

  // Array iteration methods that indicate dynamic/repeated content
  const ARRAY_METHODS = new Set([
    "map",
    "forEach",
    "filter",
    "reduce",
    "reduceRight",
    "flatMap",
    "find",
    "findIndex",
    "some",
    "every",
  ]);

  // Check if a JSX element is inside an array iteration callback
  function isJSXDynamic(jsxPath) {
    let currentPath = jsxPath.parentPath;

    while (currentPath) {
      // Check for CallExpression with array iteration method
      if (currentPath.isCallExpression()) {
        const { callee } = currentPath.node;

        if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
          const methodName = callee.property.name;
          if (ARRAY_METHODS.has(methodName)) {
            return true;
          }
        }
      }

      currentPath = currentPath.parentPath;
    }

    return false;
  }

  // Check if JSX element has any expressions (data dependencies)
  function hasAnyExpression(jsxElement) {
    const children = jsxElement.children;

    for (const child of children) {
      if (t.isJSXExpressionContainer(child)) {
        // Skip empty expressions like {/* comments */}
        if (!t.isJSXEmptyExpression(child.expression)) {
          return true; // Found an expression - this is dynamic
        }
      }
    }

    return false; // No expressions - this is static
  }

  return {
    name: "element-metadata-plugin",
    visitor: {
      // Wrap React components (capitalized JSX) with metadata divs
      JSXElement(jsxPath, state) {
        // Skip if we've already processed this node
        if (processedNodes.has(jsxPath.node)) {
          return;
        }

        const openingElement = jsxPath.node.openingElement;
        if (!openingElement.name || !openingElement.name.name) {
          return;
        }

        const elementName = openingElement.name.name;

        // Only wrap capitalized components (React components)
        if (!/^[A-Z]/.test(elementName)) {
          return;
        }

        // Exclude components that have strict child requirements or break when wrapped
        const excludedComponents = [
          "Route",
          "Routes",
          "Switch",
          "Redirect",
          "Navigate", // React Router
          "Fragment",
          "Suspense",
          "StrictMode", // React built-ins
          "ErrorBoundary",
          "Provider",
          "Consumer", // Context/Error boundaries
          "Outlet",
          "Link",
          "NavLink", // More Router components
        ];

        if (excludedComponents.includes(elementName)) {
          return;
        }

        // Check if parent is a component that strictly validates children
        const parentStrictComponents = [
          "Routes",
          "Switch",
          "BrowserRouter",
          "Router",
          "MemoryRouter",
          "HashRouter",
        ];
        const parent = jsxPath.parentPath;

        if (parent && parent.isJSXElement && parent.isJSXElement()) {
          const parentName = parent.node?.openingElement?.name?.name;
          if (parentStrictComponents.includes(parentName)) {
            // Don't wrap if direct child of strict parent (e.g., Route inside Routes)
            return;
          }
        }

        // Mark this node as processed BEFORE wrapping to prevent infinite recursion
        processedNodes.add(jsxPath.node);

        // Get source location
        const filename =
          state.filename ||
          state.file.opts.filename ||
          state.file.sourceFileName ||
          "unknown";

        const lineNumber = openingElement.loc?.start.line || 0;

        if (!fileNameCache.has(filename)) {
          const base = path.basename(filename).replace(/\.[jt]sx?$/, "");
          fileNameCache.set(filename, base);
        }
        const normalizedPath = fileNameCache.get(filename) || "unknown";

        // Detect if this JSX is inside an array iteration (dynamic content)
        // OR if it contains any expressions (data dependencies)
        const isDynamic =
          isJSXDynamic(jsxPath) || hasAnyExpression(jsxPath.node);

        // Create wrapper div with metadata and invisible styling
        const wrapper = t.jsxElement(
          t.jsxOpeningElement(
            t.jsxIdentifier("div"),
            [
              t.jsxAttribute(
                t.jsxIdentifier("x-file-name"),
                t.stringLiteral(normalizedPath),
              ),
              t.jsxAttribute(
                t.jsxIdentifier("x-line-number"),
                t.stringLiteral(lineNumber.toString()),
              ),
              t.jsxAttribute(
                t.jsxIdentifier("x-component"),
                t.stringLiteral(elementName),
              ),
              t.jsxAttribute(
                t.jsxIdentifier("x-id"),
                t.stringLiteral(`${normalizedPath}_${lineNumber}`),
              ),
              t.jsxAttribute(
                t.jsxIdentifier("x-dynamic"),
                t.stringLiteral(isDynamic ? "true" : "false"),
              ),
              t.jsxAttribute(
                t.jsxIdentifier("style"),
                t.jsxExpressionContainer(
                  t.objectExpression([
                    t.objectProperty(
                      t.identifier("display"),
                      t.stringLiteral("contents"),
                    ),
                  ]),
                ),
              ),
            ],
            false,
          ),
          t.jsxClosingElement(t.jsxIdentifier("div")),
          [jsxPath.node],
          false,
        );

        jsxPath.replaceWith(wrapper);
      },

      // Add metadata to native HTML elements (lowercase JSX)
      JSXOpeningElement(jsxPath, state) {
        if (!jsxPath.node.name || !jsxPath.node.name.name) {
          return;
        }

        const elementName = jsxPath.node.name.name;

        // Skip fragments
        if (elementName === "Fragment") {
          return;
        }

        // Only process lowercase (native HTML)
        if (/^[A-Z]/.test(elementName)) {
          return;
        }

        // Skip if already has metadata
        const hasDebugAttr = jsxPath.node.attributes.some(
          (attr) =>
            t.isJSXAttribute(attr) &&
            attr.name &&
            attr.name.name &&
            attr.name.name.startsWith("x-"),
        );
        if (hasDebugAttr) return;

        // Get source location
        const filename =
          state.filename ||
          state.file.opts.filename ||
          state.file.sourceFileName ||
          "unknown";

        const lineNumber = jsxPath.node.loc?.start.line || 0;

        if (!fileNameCache.has(filename)) {
          const base = path.basename(filename).replace(/\.[jt]sx?$/, "");
          fileNameCache.set(filename, base);
        }
        const normalizedPath = fileNameCache.get(filename) || "unknown";

        // Detect if this native element is inside an array iteration
        // OR if it contains any expressions (data dependencies)
        // For native elements, we need to check the parent JSX element
        const parentJSXElement = jsxPath.findParent((p) => p.isJSXElement());
        const isDynamic = parentJSXElement
          ? isJSXDynamic(parentJSXElement) ||
            hasAnyExpression(parentJSXElement.node)
          : false;

        // Add metadata attributes
        const debugAttributes = [
          t.jsxAttribute(
            t.jsxIdentifier("x-file-name"),
            t.stringLiteral(normalizedPath),
          ),
          t.jsxAttribute(
            t.jsxIdentifier("x-line-number"),
            t.stringLiteral(lineNumber.toString()),
          ),
          t.jsxAttribute(
            t.jsxIdentifier("x-component"),
            t.stringLiteral(elementName),
          ),
          t.jsxAttribute(
            t.jsxIdentifier("x-id"),
            t.stringLiteral(`${normalizedPath}_${lineNumber}`),
          ),
          t.jsxAttribute(
            t.jsxIdentifier("x-dynamic"),
            t.stringLiteral(isDynamic ? "true" : "false"),
          ),
        ];

        jsxPath.node.attributes.push(...debugAttributes);
      },
    },
  };
};

module.exports = {
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    configure: (webpackConfig) => {
      // Disable hot reload completely if environment variable is set
      if (config.disableHotReload) {
        // Remove hot reload related plugins
        webpackConfig.plugins = webpackConfig.plugins.filter((plugin) => {
          return !(plugin.constructor.name === "HotModuleReplacementPlugin");
        });

        // Disable watch mode
        // # ignored is READONLY, DO NOT EDIT THIS
        webpackConfig.watch = false;
        webpackConfig.watchOptions = {
          ignored: /.*/, // Ignore all files
        };
      } else {
        // Add ignored patterns to reduce watched directories
        // IMPORTANT: ignored list can only be appended, but not overridden
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            "**/node_modules/**",
            "**/.git/**",
            "**/build/**",
            "**/dist/**",
            "**/coverage/**",
            "**/public/**",
          ],
        };
      }

      return webpackConfig;
    },
  },

  // Babel configuration - adds metadata to JSX elements
  babel: {
    plugins: [babelMetadataPlugin],
  },
  devServer: (config) => {
    config.setupMiddlewares = (middlewares, devServer) => {
      if (!devServer) throw new Error("webpack-dev-server not defined");
      devServer.app.use(express.json());

      // ✅ Health check (no auth)
      devServer.app.get("/ping", (req, res) => {
        res.json({ status: "ok", time: new Date().toISOString() });
      });

      // ✅ Protected file editing endpoint with AST processing
      devServer.app.post("/edit-file", (req, res) => {
        // Add CORS headers if needed
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Content-Type, x-api-key");

        // 🔑 Check header against Supervisor password
        const key = req.get("x-api-key");
        if (!SUP_PASS || key !== SUP_PASS) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { changes } = req.body;

        if (!changes || !Array.isArray(changes) || changes.length === 0) {
          return res.status(400).json({ error: "No changes provided" });
        }

        try {
          // Track all edits for response
          const edits = [];

          // Group changes by fileName
          const changesByFile = {};
          changes.forEach((change) => {
            if (!changesByFile[change.fileName]) {
              changesByFile[change.fileName] = [];
            }
            changesByFile[change.fileName].push(change);
          });

          // Process each file's changes
          Object.entries(changesByFile).forEach(([fileName, fileChanges]) => {
            // Recursively search for the file in the frontend folder
            const frontendRoot = path.resolve(__dirname);

            const findFileRecursive = (dir, filename) => {
              try {
                const files = fs.readdirSync(dir, { withFileTypes: true });

                for (const file of files) {
                  const fullPath = path.join(dir, file.name);

                  // Skip excluded directories
                  if (file.isDirectory()) {
                    if (
                      file.name === "node_modules" ||
                      file.name === "public" ||
                      file.name === ".git" ||
                      file.name === "build" ||
                      file.name === "dist" ||
                      file.name === "coverage"
                    ) {
                      continue;
                    }
                    const found = findFileRecursive(fullPath, filename);
                    if (found) return found;
                  } else if (file.isFile()) {
                    // Check if filename matches (basename without extension)
                    const fileBaseName = file.name.replace(
                      /\.(js|jsx|ts|tsx)$/,
                      "",
                    );
                    if (fileBaseName === filename) {
                      return fullPath;
                    }
                  }
                }
              } catch (err) {
                // Ignore permission errors and continue
              }
              return null;
            };

            // Find the file
            let targetFile = findFileRecursive(frontendRoot, fileName);

            // If still not found, default to components path with .js for new files
            if (!targetFile) {
              targetFile = path.resolve(
                __dirname,
                "src/components",
                `${fileName}.js`,
              );
            }

            // Security check - prevent path traversal and restrict to frontend folder
            const normalizedTarget = path.normalize(targetFile);
            const isInFrontend =
              normalizedTarget.startsWith(frontendRoot) &&
              !normalizedTarget.includes("..");
            const isNodeModules = normalizedTarget.includes("node_modules");
            const isPublic =
              normalizedTarget.includes("/public/") ||
              normalizedTarget.endsWith("/public");

            if (!isInFrontend || isNodeModules || isPublic) {
              throw new Error(`Forbidden path for file ${fileName}`);
            }
            // Import Babel libraries
            const parser = require("@babel/parser");
            const traverse = require("@babel/traverse").default;
            const generate = require("@babel/generator").default;
            const t = require("@babel/types");

            // Read the current file content
            const currentContent = fs.readFileSync(targetFile, "utf8");

            // Parse the JSX file
            const ast = parser.parse(currentContent, {
              sourceType: "module",
              plugins: ["jsx", "typescript"],
            });

            // Helper function to parse JSX children
            const parseJsxChildren = (content) => {
              if (content === undefined) {
                return null;
              }

              const sanitizeMetaAttributes = (node) => {
                if (t.isJSXElement(node)) {
                  node.openingElement.attributes =
                    node.openingElement.attributes.filter((attr) => {
                      if (
                        t.isJSXAttribute(attr) &&
                        t.isJSXIdentifier(attr.name)
                      ) {
                        return !attr.name.name.startsWith("x-");
                      }
                      return true;
                    });

                  node.children.forEach((child) =>
                    sanitizeMetaAttributes(child),
                  );
                } else if (t.isJSXFragment(node)) {
                  node.children.forEach((child) =>
                    sanitizeMetaAttributes(child),
                  );
                }
              };

              try {
                const wrapperExpression = parser.parseExpression(
                  `(<gjs-wrapper>${content}</gjs-wrapper>)`,
                  {
                    sourceType: "module",
                    plugins: ["jsx", "typescript"],
                  },
                );

                if (t.isJSXElement(wrapperExpression)) {
                  const innerChildren = wrapperExpression.children || [];
                  innerChildren.forEach((child) =>
                    sanitizeMetaAttributes(child),
                  );
                  return innerChildren;
                }
              } catch (parseError) {
                // Fallback to treating content as raw text if parsing fails
              }

              return [t.jsxText(content)];
            };

            // Create a map of changes by line number for this file (array of changes per line)
            const changesByLine = {};
            fileChanges.forEach((change) => {
              if (!changesByLine[change.lineNumber]) {
                changesByLine[change.lineNumber] = [];
              }
              changesByLine[change.lineNumber].push(change);
            });

            // Traverse and update AST using line numbers
            traverse(ast, {
              JSXOpeningElement: (path) => {
                const lineNumber = path.node.loc?.start.line;
                if (!lineNumber) return;

                const changesAtLine = changesByLine[lineNumber];
                if (!changesAtLine || changesAtLine.length === 0) return;

                // Verify this is the correct element by checking component type
                const elementName = path.node.name.name;

                // Process ALL changes for this line
                changesAtLine.forEach((change) => {
                  if (elementName !== change.component) return;

                  // FIXED: Conditional processing based on change type
                  console.log(
                    `[backend] Processing change type: ${change.type || "legacy"} for element: ${elementName}`,
                  );

                  if (
                    change.type === "className" &&
                    change.className !== undefined
                  ) {
                    // CLASSNAME/TAILWIND PROCESSING
                    console.log(
                      `[backend] Processing className change:`,
                      change.className,
                    );

                    // Find existing className attribute
                    let classAttr = path.node.attributes.find(
                      (attr) =>
                        t.isJSXAttribute(attr) &&
                        attr.name.name === "className",
                    );

                    // Capture old className value
                    const oldClassName = classAttr?.value?.value || "";

                    if (classAttr) {
                      // Update existing className
                      console.log(
                        `[backend] Updating existing className from:`,
                        classAttr.value?.value,
                        "to:",
                        change.className,
                      );
                      classAttr.value = t.stringLiteral(change.className);
                    } else {
                      // Create new className attribute
                      console.log(
                        `[backend] Creating new className attribute:`,
                        change.className,
                      );
                      const newClassAttr = t.jsxAttribute(
                        t.jsxIdentifier("className"),
                        t.stringLiteral(change.className),
                      );
                      path.node.attributes.push(newClassAttr);
                    }

                    // Track this edit
                    const relativePath = targetFile.replace(__dirname, "");
                    edits.push({
                      file: relativePath,
                      lineNumber: lineNumber,
                      element: elementName,
                      type: "className",
                      oldData: oldClassName,
                      newData: change.className,
                    });
                  } else if (
                    change.type === "content" &&
                    change.content !== undefined
                  ) {
                    // CONTENT-ONLY PROCESSING
                    console.log(
                      `[backend] Processing content-only change:`,
                      change.content.slice(0, 100),
                    );

                    const parentElementPath = path.parentPath;
                    if (parentElementPath && parentElementPath.isJSXElement()) {
                      // Capture old content before modifying
                      const oldChildren = parentElementPath.node.children || [];
                      const oldContentAST = {
                        type: "JSXFragment",
                        children: oldChildren,
                      };
                      const oldContent = generate(oldContentAST, {}, "")
                        .code.replace(/^<>/, "")
                        .replace(/<\/>$/, "")
                        .trim();

                      const newChildren = parseJsxChildren(change.content);
                      if (newChildren) {
                        parentElementPath.node.children = newChildren;
                      }

                      // Track this edit
                      const relativePath = targetFile.replace(__dirname, "");
                      edits.push({
                        file: relativePath,
                        lineNumber: lineNumber,
                        element: elementName,
                        type: "content",
                        oldData: oldContent,
                        newData: change.content,
                      });
                    }
                  } else {
                    console.error(
                      `[backend] REJECTED: Change must have valid type ('className' or 'content'). Received:`,
                      change,
                    );
                    console.error(
                      `[backend] This change will be IGNORED to prevent contamination.`,
                    );
                  }
                });

                // Mark all changes at this line as processed
                delete changesByLine[lineNumber];
              },
            });

            // Generate updated code
            const { code } = generate(ast, {
              retainLines: true,
              retainFunctionParens: true,
              comments: true,
            });

            // Optional: Create backup before writing
            const backupFile = targetFile + ".backup";
            if (fs.existsSync(targetFile)) {
              const originalContent = fs.readFileSync(targetFile, "utf8");
              fs.writeFileSync(backupFile, originalContent, "utf8");
            }

            // Write the updated content
            fs.writeFileSync(targetFile, code, "utf8");

            // Commit changes to git with timestamp
            const timestamp = Date.now();
            try {
              // Configure git user
              execSync('git config user.name "visual-edit"');
              execSync('git config user.email "support@emergent.sh"');

              execSync(`git add "${targetFile}"`);
              execSync(`git commit -m "visual_edit_${timestamp}"`);
            } catch (gitError) {
              console.error(`Git commit failed: ${gitError.message}`);
              // Continue even if git fails - file write succeeded
            }
          });

          res.json({ status: "ok", edits });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });

      // Add OPTIONS handler for CORS preflight
      devServer.app.options("/edit-file", (req, res) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, x-api-key");
        res.sendStatus(200);
      });

      return middlewares;
    };
    return config;
  },
};
