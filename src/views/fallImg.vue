<template>
  <div class="root">
    <div class="waterfall-container" ref="container">
    <div class="waterfall-grid">
      <div v-for="(image, index) in images" :key="index" class="image-item" :class="{ loading: !image.loaded }" :style="{
        left: `${image.column * columnWidth}px`,
        top: `${image.top}px`,
        width: `${columnWidth}px`,
        height: `${image.height}px`
      }">
        <img :src="image.url" :alt="'Image ' + index" loading="lazy" @load="handleImageLoad(image)"
          :class="{ loaded: image.loaded }" />
      </div>
    </div>
    <p v-if="loading" class="loading-text">加载中...</p>
  </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';

export default {
  data() {
    return {
      images: [],
      minWidth: 100,
      columnCount: 3,
      columnWidth: 0,
      columns: [], // 存放每列当前累积的高度
      loading: false,
      observer: null,
      resizeTimeout: null,
      imageSizeCache: []
    };
  },
  mounted() {
    this.$nextTick(() => {
      this.updateColumnCount();
      window.addEventListener("resize", this.onResize);
      window.addEventListener("scroll", this.onScroll);
    });
    this.loadImages();
    this.initObserver();
  },
  computed: {
    ...mapGetters(['credentials', 'adminUrlSettings', 'userConfig']),
  },
  beforeDestroy() {
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onResize);
    this.observer?.disconnect();
  },
  methods: {
    // 监听窗口大小变化
    onResize() {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.updateColumnCount();
      }, 300); // 延迟 300ms 避免频繁触发
    },

    // 初始化 IntersectionObserver 监听滚动
    initObserver() {
      if (!this.observer) {
        this.observer = new IntersectionObserver(entries => {
          if (entries[0]?.isIntersecting) {
            this.loadImages();
          }
        }, { threshold: 0.5 });

        this.observeSecondLastRow();
      }
    },

    // 计算列数，并重新布局
    updateColumnCount() {
      if (!this.$refs?.container) return;
      const containerWidth = this.$refs.container.clientWidth;
      this.columnCount = Math.max(1, Math.floor(containerWidth / this.minWidth));
      this.columnWidth = containerWidth / this.columnCount;

      // 重新初始化列高度
      this.columns = new Array(this.columnCount).fill(0);
      this.reflowImages(); // 重新布局图片
    },

    // 重新布局图片
    async reflowImages() {
      if (!this.images.length) return;

      // 更新列数
      const newColumns = new Array(this.columnCount).fill(0);

      // 更新每张图片的位置
      const updatedImages = this.images.map(image => {
        const minCol = this.getMinColumnIndex(newColumns);
        image.column = minCol;
        image.top = newColumns[minCol];
        newColumns[minCol] += image.height;
        return image;
      });

      this.columns = newColumns;
      this.images = updatedImages;
      this.checkFull()
    },

    checkFull() {
      // 等 DOM 更新完成再判断是否填满页面
      this.$nextTick(() => {
        const containerHeight = this.$refs.container.scrollHeight;
        const viewportHeight = window.innerHeight;
        if (containerHeight < viewportHeight) {
          console.log('内容不足，继续加载图片');
          this.loadImages(); // 继续加载直到填满
        }
      });
    },

    // 获取最矮列的索引
    getMinColumnIndex(columns) {
      return columns.indexOf(Math.min(...columns));
    },

    observeSecondLastRow() {
      this.$nextTick(() => {
        const target = this.getSecondLastRowImage();
        if (target) {
          this.observer?.disconnect(); // 防止重复监听
          this.observer.observe(target);
        }
      });
    },
    getSecondLastRowImage() {
      const imageItems = this.$el.querySelectorAll(".image-item");
      const imagesPerRow = this.columnCount;
      const startIndex = Math.max(0, imageItems.length - imagesPerRow * 2);
      const lastSecondRowImages = Array.from(imageItems).slice(startIndex, startIndex + imagesPerRow);
      return lastSecondRowImages[lastSecondRowImages.length - 1] || null;
    },

    // 加载图片
    async loadImages() {
      if (this.loading) return;
      this.loading = true;

      if (this.columnWidth === 0) {
        this.updateColumnCount();
      }

      try {
        const response = await this.fetchWithAuth("/api/manage/check", { method: 'GET' });
        const result = await response.text();
        if (result !== "true" && result !== "Not using basic auth.") {
          throw new Error("Unauthorized");
        }

        const imgList = await this.fetchWithAuth(
          `/api/manage/list?start=${this.images.length}&count=20&random=true`,
          { method: "GET" }
        ).then(res => res.json());

        this.imageSizeCache = this.imageSizeCache || {};

        // 不等待统一完成，逐张加载、处理并推入
        for (const e of imgList) {
          const url = "/file/" + e.name;

          // 开始异步处理每张图片
          this.loadSingleImage(e, url);
        }
      } catch (err) {
        console.error(err);
        if (err.message !== "Unauthorized") {
          this.$message.error("同步数据时出错，请检查网络连接");
        }
      } finally {
        this.loading = false;
        this.observeSecondLastRow();
      }
    },
    async loadSingleImage(e, url) {
      let height;

      try {
        if (e.height && e.width) {
          height = this.columnWidth * (e.height / e.width);
        } else {
          if (!this.imageSizeCache[url]) {
            this.imageSizeCache[url] = this.loadImageSize(url);
          }
          const { width, height: realHeight } = await this.imageSizeCache[url];
          height = this.columnWidth * (realHeight / width);
        }

        const col = this.getMinColumnIndex(this.columns);
        const top = this.columns[col];
        this.columns[col] += height;

        const image = {
          url,
          height,
          top,
          column: col,
          loaded: false,
          channelTag: this.getChannelTag(e.metadata?.Channel),
        };

        this.images.push(image);
        // await this.reflowImages(); // 布局重新计算
      } catch (err) {
        console.warn("加载单图失败:", url, err);
      }
    },

    getChannelTag(channel) {
      if (channel === 'TelegramNew') return 'TG';
      if (channel === 'CloudflareR2') return 'R2';
      if (channel === 'S3') return 'S3';
      return '未知';
    },

    // 更新图片高度
    updateImageHeight(image, index) {
      this.$nextTick(() => {
        const imgElement = this.$el.querySelectorAll(".image-item img")[index];
        if (imgElement) {
          image.height = imgElement.clientHeight;
          if (!this.reflowPending) {
            this.reflowPending = true;
            requestAnimationFrame(() => {
              this.reflowImages();
              this.reflowPending = false;
            });
          }
        }
      });
    },

    loadImageSize(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = url;
      });
    },
    onScroll() {
      const scrollBottom = window.scrollY + window.innerHeight;
      const containerBottom = this.$refs.container.scrollHeight;
      if (containerBottom - scrollBottom < 200 && !this.loading) {
        console.log('快到底部了，自动加载更多图片');
        this.loadImages();
      }
    },
    async fetchWithAuth(url, options = {}) {
      if (this.credentials) {
        options.headers = {
          ...options.headers,
          'Authorization': `Basic ${this.credentials}`,
        };
        options.credentials = 'include';
      }

      const response = await fetch(url, options);

      if (response.status === 401) {
        this.$message.error('认证状态错误，请重新登录');
        this.$router.push('/adminLogin');
        throw new Error('Unauthorized');
      }

      return response;
    },
    handleImageLoad(image) {
      image.loaded = true// 确保 Vue 能追踪到属性变更
    }
  },
};
</script>

<style scoped>
.root {
  height: calc(100vh);
  scrollbar-width: none;
  /* Firefox */
  -ms-overflow-style: none;
  /* IE/Edge */
  overflow: auto;
  /* 允许滚动 */
}
.root::-webkit-scrollbar {
  display: none;
}
.waterfall-container {
  max-width: 100%;
  margin: 0;
  padding: 0;
  position: relative;
}

.waterfall-grid {
  position: relative;
  overflow: visible;
}

.image-item {
  position: absolute;
  transition: all 0.3s ease;
  background: #eee;
  border: 1px solid red;
}

.image-item img {
  width: 100%;
  display: block;
}

.loading-text {
  text-align: center;
  font-size: 14px;
  color: #888;
  padding: 10px;
}

/* 骨架动画默认显示 */
.image-item.loading::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, #eee, #f5f5f5, #eee);
  animation: skeleton-loading 1.2s infinite;
  z-index: 1;
  pointer-events: none;
}

/* 动画隐藏时就是加载完成了 */
.image-item:not(.loading)::after {
  display: none;
}

/* 图片渐显效果 */
.image-item img {
  width: 100%;
  display: block;
  opacity: 0;
  transition: opacity 0.5s ease-in;
  position: relative;
  z-index: 0;
}


.image-item img.loaded {
  opacity: 1;
}


@keyframes skeleton-loading {
  0% {
    background-position: -200px 0;
  }

  100% {
    background-position: calc(100% + 200px) 0;
  }
}
</style>
