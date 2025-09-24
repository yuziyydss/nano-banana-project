import os
import json
import requests
import base64
import uuid
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging
from PIL import Image
import io
from dotenv import load_dotenv, find_dotenv

# 配置日志
logger = logging.getLogger('seedream4.0')

# 加载 .env
load_dotenv(find_dotenv(), override=False)

class SeeDream4API:
    """SeeDream 4.0 API 客户端"""
    
    def __init__(self, api_key: str = None, base_url: str = None):
        # 从环境变量读取，支持传参覆盖
        env_key = os.getenv("SEEDREAM4_API_KEY")
        env_url = os.getenv("SEEDREAM4_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3/images/generations")
        self.api_key = api_key or env_key
        self.base_url = base_url or env_url
        if not self.api_key:
            raise RuntimeError("缺少 SEEDREAM4_API_KEY，请在 .env 或系统环境中配置")
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

    def generate_image(
        self,
        prompt: str,
        images: List = None,
        sequential_generation: str = "auto",
        max_images: int = 3,
        response_format: str = "url",
        size: str = "2K",
        stream: bool = True,
        watermark: bool = False
    ) -> Dict[str, Any]:
        """
        生成图像
        
        Args:
            prompt: 图像生成提示词
            images: 参考图像列表，支持URL字符串或base64格式
            sequential_generation: 序列生成模式 ("auto", "enabled", "disabled")
            max_images: 最大生成图像数量
            response_format: 响应格式 ("url", "b64_json")
            size: 图像尺寸 ("1K", "2K", "4K")
            stream: 是否流式响应
            watermark: 是否添加水印
            
        Returns:
            API响应结果
        """
        try:
            # 构建请求数据
            data = {
                "model": "doubao-seedream-4-0-250828",
                "prompt": prompt,
                "sequential_image_generation": sequential_generation,
                "sequential_image_generation_options": {
                    "max_images": max_images
                },
                "response_format": response_format,
                "size": size,
                "stream": stream,
                "watermark": watermark
            }
            
            # 如果提供了参考图像，添加到请求中
            if images:
                data["image"] = images
            
            logger.info(f"SeeDream 4.0 API 请求: {prompt[:50]}...")
            
            # 发送请求
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=data,
                timeout=60
            )
            
            # 检查响应状态
            if response.status_code != 200:
                error_msg = f"API请求失败: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": response.status_code
                }
            
            # 处理流式响应
            if stream:
                return self._handle_stream_response(response)
            else:
                result = response.json()
                logger.info("SeeDream 4.0 图像生成成功")
                return {
                    "success": True,
                    "data": result
                }
                
        except requests.exceptions.Timeout:
            error_msg = "请求超时"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}
            
        except requests.exceptions.RequestException as e:
            error_msg = f"网络请求错误: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}
            
        except Exception as e:
            error_msg = f"未知错误: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

    def _handle_stream_response(self, response) -> Dict[str, Any]:
        """处理流式响应"""
        try:
            results = []
            for line in response.iter_lines():
                if line:
                    line_text = line.decode('utf-8')
                    if line_text.startswith('data: '):
                        data_text = line_text[6:]  # 移除 'data: ' 前缀
                        if data_text.strip() == '[DONE]':
                            break
                        try:
                            data = json.loads(data_text)
                            results.append(data)
                        except json.JSONDecodeError:
                            continue
            
            return {
                "success": True,
                "data": results
            }
            
        except Exception as e:
            error_msg = f"流式响应处理错误: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

    def save_image_from_url(self, image_url: str, filename: str = None) -> str:
        """从URL保存图像到本地"""
        try:
            if not filename:
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                filename = f"seedream4_result_{timestamp}.png"
            
            # 确保输出目录存在
            output_dir = "outputs"
            os.makedirs(output_dir, exist_ok=True)
            
            filepath = os.path.join(output_dir, filename)
            
            # 下载图像
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            
            # 保存到文件
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"图像已保存到: {filepath}")
            return filepath
            
        except Exception as e:
            error_msg = f"保存图像失败: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)


def convert_image_to_base64(image_input) -> str:
    """
    将图片转换为base64格式
    
    Args:
        image_input: 可以是文件路径、PIL Image对象、或者字节数据
        
    Returns:
        base64编码的图片字符串
    """
    try:
        if isinstance(image_input, str):
            # 如果是文件路径
            with open(image_input, 'rb') as f:
                image_data = f.read()
        elif hasattr(image_input, 'read'):
            # 如果是文件对象
            image_data = image_input.read()
            if hasattr(image_input, 'seek'):
                image_input.seek(0)  # 重置文件指针
        elif isinstance(image_input, bytes):
            # 如果是字节数据
            image_data = image_input
        elif isinstance(image_input, Image.Image):
            # 如果是PIL Image对象
            buffer = io.BytesIO()
            image_input.save(buffer, format='PNG')
            image_data = buffer.getvalue()
        else:
            raise ValueError(f"不支持的图片输入类型: {type(image_input)}")
        
        # 转换为base64
        base64_string = base64.b64encode(image_data).decode('utf-8')
        return f"data:image/png;base64,{base64_string}"
        
    except Exception as e:
        error_msg = f"图片转换base64失败: {str(e)}"
        logger.error(error_msg)
        raise Exception(error_msg)


def generate_image_with_seedream4(
    prompt: str,
    images: List = None,
    max_images: int = 1,
    size: str = "2K"
) -> Dict[str, Any]:
    """
    使用SeeDream 4.0生成图像的便捷函数
    
    Args:
        prompt: 图像生成提示词
        images: 参考图像列表，可以是URL字符串、文件路径、PIL Image对象或文件对象
        max_images: 最大生成图像数量
        size: 图像尺寸
        
    Returns:
        生成结果
    """
    try:
        api = SeeDream4API()
        
        # 处理图片参数，将上传的图片转换为base64
        processed_images = None
        if images:
            processed_images = []
            for img in images:
                if isinstance(img, str) and (img.startswith('http://') or img.startswith('https://')):
                    # 如果是URL，直接使用
                    processed_images.append(img)
                else:
                    # 如果是文件或其他格式，转换为base64
                    try:
                        base64_img = convert_image_to_base64(img)
                        processed_images.append(base64_img)
                        logger.info("图片已转换为base64格式")
                    except Exception as e:
                        logger.warning(f"图片转换失败，跳过: {e}")
                        continue
        
        # 调用API生成图像
        result = api.generate_image(
            prompt=prompt,
            images=processed_images,
            max_images=max_images,
            size=size,
            stream=False  # 简化处理，不使用流式响应
        )
        
        if not result["success"]:
            return result
        
        # 处理生成的图像
        generated_images = []
        data = result["data"]
        
        if "data" in data and isinstance(data["data"], list):
            for item in data["data"]:
                if "url" in item:
                    # 保存图像到本地
                    try:
                        filepath = api.save_image_from_url(item["url"])
                        generated_images.append({
                            "url": item["url"],
                            "local_path": filepath
                        })
                    except Exception as e:
                        logger.warning(f"保存图像失败: {e}")
                        generated_images.append({
                            "url": item["url"],
                            "local_path": None
                        })
        
        return {
            "success": True,
            "message": "SeeDream 4.0 图像生成成功",
            "images": generated_images,
            "raw_response": data
        }
        
    except Exception as e:
        error_msg = f"SeeDream 4.0 生成失败: {str(e)}"
        logger.error(error_msg)
        return {
            "success": False,
            "error": error_msg
        }


if __name__ == "__main__":
    # 测试代码
    print("测试 SeeDream 4.0 API...")
    
    # 测试文生图
    print("\n=== 测试文生图功能 ===")
    result = generate_image_with_seedream4(
        prompt="一只可爱的小猫在花园里玩耍，阳光明媚，卡通风格",
        max_images=1,
        size="2K"
    )
    
    if result["success"]:
        print(f"✅ 文生图成功: {result['message']}")
        for i, img in enumerate(result["images"]):
            print(f"   图像 {i+1}: {img['local_path']}")
    else:
        print(f"❌ 文生图失败: {result['error']}")
    
    # 测试图生图（需要提供参考图像URL）
    print("\n=== 测试图生图功能 ===")
    reference_images = [
        "https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seedream4_imagesToimages_1.png"
    ]
    
    result = generate_image_with_seedream4(
        prompt="将这个场景改为夜晚，添加星空和月亮",
        images=reference_images,
        max_images=1,
        size="2K"
    )
    
    if result["success"]:
        print(f"✅ 图生图成功: {result['message']}")
        for i, img in enumerate(result["images"]):
            print(f"   图像 {i+1}: {img['local_path']}")
    else:
        print(f"❌ 图生图失败: {result['error']}")
    
    print("\n测试完成！")