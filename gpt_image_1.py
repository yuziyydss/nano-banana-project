"""
Azure OpenAI gpt-image-1 通用工具：支持文生图与图生图

- 依赖环境变量（建议在项目根目录 .env 配置）：
  AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
  AZURE_OPENAI_API_KEY=<your-key>
  AZURE_OPENAI_DEPLOYMENT_NAME=gpt-image-1  # 部署名

- 提供两个核心函数：
  1) text_to_image(prompt, size="1024x1024", n=1, quality="high")
  2) image_to_image(image_path, prompt, size="1024x1024", n=1, quality="high", mask_path=None)

- 返回值：均返回 List[bytes]，每个元素为 PNG 图片的原始字节，可配合 save_images 保存到本地。

注意：不要在代码中硬编码密钥，默认从环境变量读取。
"""
from __future__ import annotations

import base64
import os
import mimetypes
from typing import List, Optional

import requests
from openai import AzureOpenAI
# 新增：在模块内加载 .env，确保直接运行该文件也能读取环境变量
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(), override=False)

# API 版本：images.generate 与 images/edits 目前使用不同的预览版本
API_VERSION_IMAGE = os.getenv("AZURE_OPENAI_API_VERSION", "2025-03-01-preview")
API_VERSION_EDITS = os.getenv("AZURE_OPENAI_API_VERSION_EDITS", "2025-04-01-preview")

# 读取环境变量
AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-image-1")


def _ensure_env():
    missing = []
    if not AZURE_ENDPOINT:
        missing.append("AZURE_OPENAI_ENDPOINT")
    if not AZURE_API_KEY:
        missing.append("AZURE_OPENAI_API_KEY")
    if not DEPLOYMENT_NAME:
        missing.append("AZURE_OPENAI_DEPLOYMENT_NAME")
    if missing:
        raise RuntimeError(
            "缺少必要环境变量: " + ", ".join(missing) +
            ". 请在 .env 或系统环境中配置。"
        )


def _image_mime_by_path(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    return mime or "image/png"


def _client() -> AzureOpenAI:
    _ensure_env()
    return AzureOpenAI(
        azure_endpoint=AZURE_ENDPOINT,
        api_key=AZURE_API_KEY,
        api_version=API_VERSION_IMAGE,
    )


def text_to_image(
    prompt: str,
    *,
    size: str = "1024x1024",
    n: int = 1,
    quality: str = "high",
    model: Optional[str] = None,
) -> List[bytes]:
    """文生图：返回 n 张 PNG 图像的字节数组列表。

    参数:
      - prompt: 提示词
      - size: 例如 "1024x1024" | "512x512" | "256x256"
      - n: 生成数量 (1-10，依据配额)
      - quality: "high" | "standard"
      - model: 可选，默认使用 DEPLOYMENT_NAME
    """
    if not prompt or not prompt.strip():
        raise ValueError("prompt 不能为空")

    client = _client()
    resp = client.images.generate(
        model=model or DEPLOYMENT_NAME,
        prompt=prompt,
        size=size,
        n=int(n),
        quality=quality,
    )
    images: List[bytes] = []
    for item in getattr(resp, "data", []) or []:
        b64 = getattr(item, "b64_json", None)
        if b64:
            images.append(base64.b64decode(b64))
    return images


def image_to_image(
    image_path: str,
    prompt: str,
    *,
    size: str = "1024x1024",
    n: int = 1,
    quality: str = "high",
    model: Optional[str] = None,
    mask_path: Optional[str] = None,
    timeout: int = 180,
) -> List[bytes]:
    """图生图（编辑）：基于输入图片与提示词生成 n 张图像。

    参数:
      - image_path: 源图片路径（必填）
      - prompt: 编辑说明/生成提示
      - size: 输出尺寸，如 "1024x1024"
      - n: 生成数量
      - quality: "high" | "standard"
      - model: 可选，默认使用 DEPLOYMENT_NAME
      - mask_path: 可选遮罩图路径（黑白图，黑色区域会被替换）
      - timeout: 请求超时（秒），默认 120 秒
    """
    _ensure_env()
    if not os.path.isfile(image_path):
        raise FileNotFoundError(f"找不到输入图片: {image_path}")

    url = (
        f"{AZURE_ENDPOINT}/openai/deployments/"
        f"{model or DEPLOYMENT_NAME}/images/edits"
        f"?api-version={API_VERSION_EDITS}"
    )

    files = {
        # Azure 期望字段名为 image[]
        "image[]": (os.path.basename(image_path), open(image_path, "rb"), _image_mime_by_path(image_path)),
    }
    if mask_path:
        if not os.path.isfile(mask_path):
            raise FileNotFoundError(f"找不到遮罩图片: {mask_path}")
        files["mask"] = (os.path.basename(mask_path), open(mask_path, "rb"), _image_mime_by_path(mask_path))

    data = {
        "model": model or DEPLOYMENT_NAME,
        "prompt": prompt,
        "size": size,
        "n": str(int(n)),
        "quality": quality,
        # 可以按需新增如 background, style 等参数（若 API 支持）
    }

    headers = {
        "api-key": AZURE_API_KEY,
    }

    resp = requests.post(url, headers=headers, files=files, data=data, timeout=timeout)
    resp.raise_for_status()
    payload = resp.json()
    images: List[bytes] = []
    for item in payload.get("data", []) or []:
        b64 = item.get("b64_json")
        if b64:
            images.append(base64.b64decode(b64))
    return images


def save_images(images: List[bytes], output_dir: str = "outputs", prefix: str = "gpt_image_1") -> List[str]:
    """将字节数组列表保存为 PNG 文件，返回保存路径列表。"""
    if not images:
        return []
    os.makedirs(output_dir, exist_ok=True)
    saved = []
    for idx, data in enumerate(images, 1):
        path = os.path.join(output_dir, f"{prefix}_{idx}.png")
        with open(path, "wb") as f:
            f.write(data)
        saved.append(path)
    return saved

# 新增：将本地图片转为 base64（可选 data URL 格式）
def encode_image_to_base64(image_path: str, *, as_data_url: bool = True) -> str:
    """读取本地图片并转为 base64 字符串。

    参数:
      - image_path: 本地图片路径
      - as_data_url: 是否返回 data URL 形式（如 data:image/png;base64,<...>）
    返回:
      - base64 字符串（默认 data URL）
    """
    if not os.path.isfile(image_path):
        raise FileNotFoundError(f"找不到输入图片: {image_path}")
    mime = _image_mime_by_path(image_path)
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return (f"data:{mime};base64,{b64}") if as_data_url else b64

# 新增：以 base64 的方式调用 Azure images/edits（直接作为 JSON 的 image 参数）
def image_to_image_with_base64(
    image_path: str,
    prompt: str,
    *,
    size: str = "1024x1024",
    n: int = 1,
    quality: str = "high",
    model: Optional[str] = None,
    mask_path: Optional[str] = None,
    use_data_url: bool = True,
    timeout: int = 120,
) -> List[bytes]:
    """图生图（使用 base64 直传）

    与 image_to_image 的区别：不走 multipart 文件上传，而是把图片以 base64（默认 data URL）
    放在 JSON body 的 image 字段中（mask 同理）。
    注意：该用法依赖服务端是否支持 base64 直传。
    参数:
      - timeout: 请求超时（秒），默认 120 秒
    """
    _ensure_env()
    url = (
        f"{AZURE_ENDPOINT}/openai/deployments/"
        f"{model or DEPLOYMENT_NAME}/images/edits"
        f"?api-version={API_VERSION_EDITS}"
    )

    image_b64 = encode_image_to_base64(image_path, as_data_url=use_data_url)
    payload = {
        "model": model or DEPLOYMENT_NAME,
        "prompt": prompt,
        "size": size,
        "n": int(n),
        "quality": quality,
        "image": image_b64,
    }

    if mask_path:
        if not os.path.isfile(mask_path):
            raise FileNotFoundError(f"找不到遮罩图片: {mask_path}")
        payload["mask"] = encode_image_to_base64(mask_path, as_data_url=use_data_url)

    headers = {
        "api-key": AZURE_API_KEY,
        "Content-Type": "application/json",
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    payload = resp.json()
    images: List[bytes] = []
    for item in payload.get("data", []) or []:
        b64 = item.get("b64_json")
        if b64:
            images.append(base64.b64decode(b64))
    return images


def generate_image(
    prompt: str,
    image_path: Optional[str] = None,
    *,
    size: str = "1024x1024",
    n: int = 1,
    quality: str = "high",
    model: Optional[str] = None,
    mask_path: Optional[str] = None,
    use_base64: bool = False,
    timeout: int = 180,
) -> List[bytes]:
    """通用生图函数

    - 不传 image_path => 文生图（text_to_image）
    - 传 image_path => 图生图（image_to_image 或 image_to_image_with_base64）

    参数:
      - prompt: 提示词
      - image_path: 可选，作为图生图输入图像路径；不传则执行文生图
      - size: 输出尺寸，例如 "1024x1024"
      - n: 生成数量
      - quality: "high" | "standard"
      - model: 部署名，默认取环境变量配置
      - mask_path: 可选遮罩图（仅图生图有效）
      - use_base64: True 时使用 base64 直传通道（依赖服务端支持）
      - timeout: 请求超时（秒），默认 120 秒
    返回: List[bytes] 每个元素为 PNG 字节
    """
    if image_path:
        if use_base64:
            return image_to_image_with_base64(
                image_path,
                prompt,
                size=size,
                n=n,
                quality=quality,
                model=model,
                mask_path=mask_path,
                timeout=timeout,
            )
        return image_to_image(
            image_path,
            prompt,
            size=size,
            n=n,
            quality=quality,
            model=model,
            mask_path=mask_path,
            timeout=timeout,
        )
    # 文生图
    return text_to_image(
        prompt,
        size=size,
        n=n,
        quality=quality,
        model=model,
    )


if __name__ == "__main__":
    # 示例：仅在你本地设置好环境变量后再执行
    # 1) 文生图
    try:
        imgs = text_to_image("A cute otter skating in the night city, cartoon, vibrant", size="1024x1024", n=1)
        paths = save_images(imgs, prefix="demo_t2i")
        print("文生图已保存:", paths)
    except Exception as e:
        print("文生图示例失败:", e)

    # 2) 图生图（需要本地有一张输入图片）
    # sample_input = os.getenv("GPT_IMAGE_SAMPLE_INPUT")  # 可在 .env 中指定
    sample_input = "C:/Users/1/Desktop/素材/banana_test/11.png"
    if sample_input and os.path.isfile(sample_input):
        try:
            imgs2 = image_to_image(sample_input, "make it more colorful and add a soft glow", size="1024x1024", n=1, timeout=240)
            paths2 = save_images(imgs2, prefix="demo_i2i")
            print("图生图已保存:", paths2)
        except Exception as e:
            print("图生图示例失败:", e)
