#!/usr/bin/env python3
"""Generate the checked-in Xcode project using only Python's standard library."""
import hashlib
import json
import plistlib
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
subprocess.run(["/usr/bin/python3", str(root / "scripts/prepare_extensions.py")], check=True)
objects = {}

def ident(name):
    return hashlib.sha256(name.encode()).hexdigest()[:24].upper()

def add(identifier, isa, **fields):
    key = ident(identifier)
    objects[key] = dict(isa=isa, **fields)
    return key

def ref(path, kind):
    return add("file:" + path, "PBXFileReference", path=path, sourceTree="<group>", lastKnownFileType=kind)

def build_file(path, kind):
    return add("build:" + path, "PBXBuildFile", fileRef=ref(path, kind))

app_sources = sorted(str(p.relative_to(root)) for folder in ["App", "Shared", "Sources/MonitorCore"]
                     for p in (root / folder).glob("*.swift"))
extension_sources = ["SafariExtension/SafariWebExtensionHandler.swift"]
ios_sources = sorted(str(p.relative_to(root)) for folder in ["iOS", "Shared", "Sources/MonitorCore"]
                     for p in (root / folder).glob("*.swift"))
resources = sorted(str(p.relative_to(root)) for p in (root / "Browser/safari").iterdir() if p.is_file())
app_product = add("appProduct", "PBXFileReference", explicitFileType="wrapper.application", path="Deep Focus Native.app", sourceTree="BUILT_PRODUCTS_DIR")
ext_product = add("extProduct", "PBXFileReference", explicitFileType="wrapper.app-extension", path="DeepFocusSafari.appex", sourceTree="BUILT_PRODUCTS_DIR")
ios_product = add("iosProduct", "PBXFileReference", explicitFileType="wrapper.application", path="Deep Focus Companion.app", sourceTree="BUILT_PRODUCTS_DIR")
app_source_phase = add("appSources", "PBXSourcesBuildPhase", buildActionMask=2147483647,
                       files=[build_file(p, "sourcecode.swift") for p in app_sources], runOnlyForDeploymentPostprocessing=0)
ext_source_phase = add("extSources", "PBXSourcesBuildPhase", buildActionMask=2147483647,
                       files=[build_file(p, "sourcecode.swift") for p in extension_sources], runOnlyForDeploymentPostprocessing=0)
ext_resources = add("extResources", "PBXResourcesBuildPhase", buildActionMask=2147483647,
                    files=[build_file(p, "text") for p in resources], runOnlyForDeploymentPostprocessing=0)
ios_source_phase = add("iosSources", "PBXSourcesBuildPhase", buildActionMask=2147483647,
                      files=[add("iosBuild:" + p, "PBXBuildFile", fileRef=ref(p, "sourcecode.swift")) for p in ios_sources], runOnlyForDeploymentPostprocessing=0)
embed_file = add("embedFile", "PBXBuildFile", fileRef=ext_product, settings={"ATTRIBUTES": ["RemoveHeadersOnCopy"]})
embed = add("embed", "PBXCopyFilesBuildPhase", buildActionMask=2147483647, dstPath="", dstSubfolderSpec=13,
            files=[embed_file], name="Embed App Extensions", runOnlyForDeploymentPostprocessing=0)

def configurations(name, settings):
    configs = []
    for variant in ["Debug", "Release"]:
        values = dict(settings)
        values.update(SWIFT_OPTIMIZATION_LEVEL="-Onone" if variant == "Debug" else "-O",
                      DEBUG_INFORMATION_FORMAT="dwarf" if variant == "Debug" else "dwarf-with-dsym")
        if variant == "Debug":
            values["SWIFT_ACTIVE_COMPILATION_CONDITIONS"] = "DEBUG"
        configs.append(add(name + variant, "XCBuildConfiguration", buildSettings=values, name=variant))
    return add(name + "Configs", "XCConfigurationList", buildConfigurations=configs,
               defaultConfigurationIsVisible=0, defaultConfigurationName="Release")

common = dict(SDKROOT="macosx", MACOSX_DEPLOYMENT_TARGET="14.0", SWIFT_VERSION="5.0",
              CLANG_ENABLE_MODULES="YES", ENABLE_HARDENED_RUNTIME="YES", CODE_SIGN_STYLE="Manual",
              CODE_SIGN_IDENTITY="-", CODE_SIGNING_ALLOWED="YES", GENERATE_INFOPLIST_FILE="NO",
              CODE_SIGN_INJECT_BASE_ENTITLEMENTS="NO",
              CURRENT_PROJECT_VERSION="2", MARKETING_VERSION="0.2.0")
app_settings = dict(common, PRODUCT_BUNDLE_IDENTIFIER="com.timeowilliams.DeepFocusNative",
                    PRODUCT_NAME="Deep Focus Native", PRODUCT_MODULE_NAME="DeepFocusNative",
                    INFOPLIST_FILE="Configuration/App-Info.plist", CODE_SIGN_ENTITLEMENTS="Configuration/App.entitlements",
                    LD_RUNPATH_SEARCH_PATHS=["$(inherited)", "@executable_path/../Frameworks"])
ext_settings = dict(common, PRODUCT_BUNDLE_IDENTIFIER="com.timeowilliams.DeepFocusNative.Safari",
                    PRODUCT_NAME="DeepFocusSafari", PRODUCT_MODULE_NAME="DeepFocusSafari", SKIP_INSTALL="YES",
                    APPLICATION_EXTENSION_API_ONLY="YES", INFOPLIST_FILE="Configuration/Safari-Info.plist",
                    CODE_SIGN_ENTITLEMENTS="Configuration/Safari.entitlements")
ios_settings = dict(common, SDKROOT="iphoneos", SUPPORTED_PLATFORMS="iphoneos iphonesimulator",
                    IPHONEOS_DEPLOYMENT_TARGET="17.0", TARGETED_DEVICE_FAMILY="1,2",
                    PRODUCT_BUNDLE_IDENTIFIER="com.timeowilliams.DeepFocusCompanion",
                    PRODUCT_NAME="Deep Focus Companion", PRODUCT_MODULE_NAME="DeepFocusCompanion",
                    INFOPLIST_FILE="Configuration/iOS-Info.plist")
ext_target = add("extTarget", "PBXNativeTarget", name="DeepFocusSafari", productName="DeepFocusSafari",
                 productReference=ext_product, productType="com.apple.product-type.app-extension",
                 buildConfigurationList=configurations("ext", ext_settings),
                 buildPhases=[ext_source_phase, ext_resources], buildRules=[], dependencies=[])
proxy = add("proxy", "PBXContainerItemProxy", containerPortal=ident("project"), proxyType=1,
            remoteGlobalIDString=ext_target, remoteInfo="DeepFocusSafari")
dependency = add("dependency", "PBXTargetDependency", target=ext_target, targetProxy=proxy)
app_target = add("appTarget", "PBXNativeTarget", name="DeepFocusNative", productName="Deep Focus Native",
                 productReference=app_product, productType="com.apple.product-type.application",
                 buildConfigurationList=configurations("app", app_settings),
                 buildPhases=[app_source_phase, embed], buildRules=[], dependencies=[dependency])
ios_target = add("iosTarget", "PBXNativeTarget", name="DeepFocusCompanion", productName="Deep Focus Companion",
                 productReference=ios_product, productType="com.apple.product-type.application",
                 buildConfigurationList=configurations("ios", ios_settings),
                 buildPhases=[ios_source_phase], buildRules=[], dependencies=[])
products = add("products", "PBXGroup", name="Products", sourceTree="<group>", children=[app_product, ext_product, ios_product])
main_group = add("mainGroup", "PBXGroup", sourceTree="<group>",
                 children=[ident("file:" + p) for p in sorted(set(app_sources + extension_sources + resources + ios_sources))] + [products])
project = add("project", "PBXProject", attributes={"LastUpgradeCheck": "1630", "BuildIndependentTargetsInParallel": "YES"},
              buildConfigurationList=configurations("project", {}), compatibilityVersion="Xcode 14.0",
              developmentRegion="en", hasScannedForEncodings=0, knownRegions=["en", "Base"],
              mainGroup=main_group, productRefGroup=products, projectDirPath="", projectRoot="", targets=[app_target, ext_target, ios_target])

def serialize(value, indent=0):
    if isinstance(value, dict):
        return "{\n" + "".join("\t" * (indent + 1) + json.dumps(k) + " = " + serialize(v, indent + 1) + ";\n"
                               for k, v in value.items()) + "\t" * indent + "}"
    if isinstance(value, list):
        return "(" + ", ".join(serialize(v, indent) for v in value) + ")"
    return str(value) if isinstance(value, int) else json.dumps(value)

project_dir = root / "DeepFocusNative.xcodeproj"
project_dir.mkdir(exist_ok=True)
(project_dir / "project.pbxproj").write_text("// !$*UTF8*$!\n" + serialize(dict(archiveVersion=1, classes={}, objectVersion=56, objects=objects, rootObject=project)) + "\n")
scheme_dir = project_dir / "xcshareddata/xcschemes"
scheme_dir.mkdir(parents=True, exist_ok=True)
buildable = f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{app_target}" BuildableName="Deep Focus Native.app" BlueprintName="DeepFocusNative" ReferencedContainer="container:DeepFocusNative.xcodeproj"/>'
(scheme_dir / "DeepFocusNative.xcscheme").write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1630" version="1.3">
 <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{buildable}</BuildActionEntry></BuildActionEntries></BuildAction>
 <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{buildable}</BuildableProductRunnable></LaunchAction>
 <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{buildable}</BuildableProductRunnable></ProfileAction>
 <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''')
ios_buildable = f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{ios_target}" BuildableName="Deep Focus Companion.app" BlueprintName="DeepFocusCompanion" ReferencedContainer="container:DeepFocusNative.xcodeproj"/>'
(scheme_dir / "DeepFocusCompanion.xcscheme").write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1630" version="1.3">
 <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ios_buildable}</BuildActionEntry></BuildActionEntries></BuildAction>
 <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ios_buildable}</BuildableProductRunnable></LaunchAction>
 <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''')

config = root / "Configuration"
config.mkdir(exist_ok=True)
base = dict(CFBundleDevelopmentRegion="en", CFBundleExecutable="$(EXECUTABLE_NAME)",
            CFBundleIdentifier="$(PRODUCT_BUNDLE_IDENTIFIER)", CFBundleInfoDictionaryVersion="6.0",
            CFBundleName="$(PRODUCT_NAME)", CFBundleShortVersionString="$(MARKETING_VERSION)",
            CFBundleVersion="$(CURRENT_PROJECT_VERSION)", LSMinimumSystemVersion="$(MACOSX_DEPLOYMENT_TARGET)")
plists = {
    "App-Info.plist": dict(base, CFBundlePackageType="APPL", LSUIElement=True, NSPrincipalClass="NSApplication",
                          NSHumanReadableCopyright="Copyright © 2026 Timeo Williams", LSApplicationCategoryType="public.app-category.productivity"),
    "Safari-Info.plist": dict(base, CFBundlePackageType="XPC!", CFBundleDisplayName="Deep Focus Browser Monitor",
                             NSExtension={"NSExtensionPointIdentifier": "com.apple.Safari.web-extension",
                                          "NSExtensionPrincipalClass": "$(PRODUCT_MODULE_NAME).SafariWebExtensionHandler"},
                             NSAppTransportSecurity={"NSAllowsLocalNetworking": True}),
    "App.entitlements": {"com.apple.security.app-sandbox": True, "com.apple.security.network.server": True,
                         "com.apple.security.files.user-selected.read-write": True},
    "Safari.entitlements": {"com.apple.security.app-sandbox": True, "com.apple.security.network.client": True},
    "iOS-Info.plist": dict(base, CFBundlePackageType="APPL", CFBundleDisplayName="Deep Focus",
                          UILaunchScreen={}, UIApplicationSceneManifest={"UIApplicationSupportsMultipleScenes": False},
                          UISupportedInterfaceOrientations=["UIInterfaceOrientationPortrait", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"],
                          NSLocationWhenInUseUsageDescription="Deep Focus can record optional coarse place visits to help you reconstruct your day.",
                          NSLocationAlwaysAndWhenInUseUsageDescription="Allow optional background place visits so you can confirm time away from your computer later. Coarse locations stay on this phone until you export them."),
}
for name, value in plists.items():
    destination = config / name
    content = plistlib.dumps(value)
    if not destination.exists() or destination.read_bytes() != content:
        destination.write_bytes(content)
print("Generated Xcode project and browser bundles.")
